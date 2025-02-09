import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts'
import { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'

import { useTicketInspectors } from 'src/contexts/TicketInspectorsContext'
import { MarkerData } from 'src/utils/types'
import { getRecentDataWithIfModifiedSince } from 'src/utils/dbUtils'
import { getLineColor } from 'src/utils/uiUtils'

import ReportItem from './ReportItem'
import ClusteredReportItem from './ClusteredReportItem'

import { useRiskData } from 'src/contexts/RiskDataContext'
import { useStationsAndLines } from 'src/contexts/StationsAndLinesContext'

import './ReportsModal.css'

interface ReportsModalProps {
    className?: string
    closeModal: () => void
}

type TabType = 'summary' | 'lines' | 'stations'

const ReportsModal: React.FC<ReportsModalProps> = ({ className, closeModal }) => {
    const { t } = useTranslation()
    const [currentTab, setCurrentTab] = useState<TabType>('summary')

    const tabs: TabType[] = ['summary', 'lines', 'stations']

    const handleTabChange = (tab: TabType) => {
        setCurrentTab(tab)
    }

    const [ticketInspectorList, setTicketInspectorList] = useState<MarkerData[]>([])
    const { ticketInspectorList: lastHourInspectorList } = useTicketInspectors()

    const currentTime = useMemo(() => new Date().getTime(), [])

    useEffect(() => {
        /**
         * Fetches and processes ticket inspector data for the last 24 hours.
         *
         * This function performs the following tasks:
         * 1. Retrieves inspector data from 24 hours ago to 1 hour ago via the API.
         *    This approach ensures we capture historic data that may not be included
         *    when fetching the full 24-hour period due to data thresholds.
         * 2. Separates recent and historic inspectors from the last hour's data.
         * 3. Excludes historic inspectors from the previous day's data to cover edge cases.
         * 4. Sorts all inspector lists chronologically, with most recent entries first.
         *    The order is last hour, historic, previous day.
         * 5. Merges and flattens the sorted lists into a single, comprehensive dataset.
         *
         * The processed list is then stored in the component's state via setTicketInspectorList.
         *
         * @async
         * @function
         * @returns {Promise<void>}
         */
        const fetchInspectorList = async () => {
            const startTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60 * 24).toISOString()
            const endTimeInRFC3339 = new Date(currentTime - 1000 * 60 * 60).toISOString()

            const previousDayInspectorList =
                (await getRecentDataWithIfModifiedSince(
                    `${process.env.REACT_APP_API_URL}/basics/inspectors?start=${startTimeInRFC3339}&end=${endTimeInRFC3339}`,
                    null // no caching to make it less error prone
                )) || [] // in case the server returns, 304 Not Modified

            // Separate historic inspectors from lastHourInspectorList
            const historicInspectors = lastHourInspectorList.filter((inspector) => inspector.isHistoric)
            const recentInspectors = lastHourInspectorList.filter((inspector) => !inspector.isHistoric)

            // remove historic inspectors from previousDayInspectorList
            const filteredPreviousDayInspectorList = previousDayInspectorList.filter(
                (inspector: MarkerData) => !inspector.isHistoric
            )

            const sortByTimestamp = (a: MarkerData, b: MarkerData): number =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

            const sortedLists = [recentInspectors, historicInspectors, filteredPreviousDayInspectorList].map((list) =>
                list.sort(sortByTimestamp)
            )
            setTicketInspectorList(sortedLists.flat())
        }
        fetchInspectorList()
    }, [currentTime, lastHourInspectorList])

    const [sortedLinesWithReports, setSortedLinesWithReports] = useState<Map<string, MarkerData[]>>(new Map())

    useEffect(() => {
        const getAllLinesWithReportsSorted = (): Map<string, MarkerData[]> => {
            const lineReports = new Map<string, MarkerData[]>()

            // Group reports by line
            for (const inspector of ticketInspectorList) {
                const { line } = inspector
                if (line === '') continue
                lineReports.set(line, [...(lineReports.get(line) || []), inspector])
            }

            return new Map(Array.from(lineReports.entries()).sort((a, b) => b[1].length - a[1].length))
        }

        const sortedLines = getAllLinesWithReportsSorted()
        setSortedLinesWithReports(sortedLines)
    }, [ticketInspectorList])

    const { segmentRiskData } = useRiskData()
    const { allLines } = useStationsAndLines()
    const [riskLines, setRiskLines] = useState<Map<string, LineRiskData>>(new Map())

    interface LineRiskData {
        score: number
        class: number
    }

    useEffect(() => {
        if (segmentRiskData && segmentRiskData.segment_colors) {
            const extractMostRiskLines = (segmentColors: Record<string, string>): Map<string, LineRiskData> => {
                const colorScores: Record<string, number> = {
                    '#A92725': 3, // bad
                    '#F05044': 2, // medium
                    '#FACB3F': 1, // okay
                }

                const lineScores = new Map<string, LineRiskData>()

                Object.entries(segmentColors).forEach(([segmentId, color]) => {
                    const line = segmentId.split('-')[0]
                    const score = colorScores[color] || 0 // 0 is no risk, which is not returned by the API

                    if (!lineScores.has(line)) {
                        lineScores.set(line, { score, class: score })
                    } else {
                        const currentData = lineScores.get(line)!
                        lineScores.set(line, {
                            score: currentData.score + score,
                            class: Math.max(currentData.class, score),
                        })
                    }
                })

                return new Map(Array.from(lineScores.entries()).sort(([, a], [, b]) => b.score - a.score))
            }

            const riskMap = extractMostRiskLines(segmentRiskData.segment_colors)
            Object.keys(allLines).forEach((line) => {
                if (!riskMap.has(line)) {
                    riskMap.set(line, { score: 0, class: 0 })
                }
            })
            setRiskLines(riskMap)
        }
    }, [segmentRiskData, allLines])

    const getChartData = useMemo(() => {
        return Array.from(sortedLinesWithReports.entries()).map(([line, reports]) => ({
            line,
            reports: reports.length,
        }))
    }, [sortedLinesWithReports])

    const [isLightTheme, setIsLightTheme] = useState<boolean>(false)

    useEffect(() => {
        const theme = localStorage.getItem('colorTheme')
        setIsLightTheme(theme === 'light')

        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'theme') {
                setIsLightTheme(e.newValue === 'dark')
            }
        }
        window.addEventListener('storage', handleStorageChange)
        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    const CustomTooltip: React.FC<TooltipProps<ValueType, NameType>> = ({ active, payload }) => {
        if (!active || !payload || !payload.length) return null

        const data = payload[0].payload
        const totalReports = getChartData.reduce((sum, item) => sum + item.reports, 0)
        const percentage = ((data.reports / totalReports) * 100).toFixed(1)

        return (
            <div
                className="custom-tooltip"
                style={{
                    backgroundColor: isLightTheme ? '#fff' : '#000',
                    color: isLightTheme ? '#000' : '#fff',
                    padding: '8px',
                    borderRadius: '4px',
                }}
            >
                <h4>{`${percentage}% ${t('ReportsModal.ofTotal')}`}</h4>
                <p>{`${data.reports} ${t('ReportsModal.reports')}`}</p>
            </div>
        )
    }

    return (
        <div className={`reports-modal modal container ${className}`}>
            <section className="tabs align-child-on-line">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => handleTabChange(tab)}
                        className={currentTab === tab ? 'active' : ''}
                    >
                        <h3>{t(`ReportsModal.${tab}`)}</h3>
                    </button>
                ))}
            </section>
            {currentTab === 'summary' && (
                <section className="summary">
                    <section className="lines">
                        <h2>{t('ReportsModal.top5Lines')}</h2>
                        <p>{t('ReportsModal.past24Hours')}</p>
                        {Array.from(sortedLinesWithReports.entries())
                            .slice(0, 5)
                            .sort(([, inspectorsA], [, inspectorsB]) => {
                                const timestampA = new Date(inspectorsA[0].timestamp).getTime()
                                const timestampB = new Date(inspectorsB[0].timestamp).getTime()
                                return timestampB - timestampA // most recent first
                            })
                            .map(([line, inspectors]) => (
                                <ClusteredReportItem key={line} inspectors={inspectors} />
                            ))}
                    </section>
                    <section className="risk">
                        <h2>{t('ReportsModal.risk')}</h2>
                        <div className="risk-grid">
                            {Array.from(riskLines.entries()).some(
                                ([, riskData]) => riskData.class === 2 || riskData.class === 3
                            ) && (
                                <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 2 || riskData.class === 3)
                                        .map(([line, riskData]) => (
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => closeModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <h4
                                                    className="line-label"
                                                    style={{ backgroundColor: getLineColor(line) }}
                                                >
                                                    {line}
                                                </h4>
                                            </div>
                                        ))}
                                </div>
                            )}
                            {Array.from(riskLines.entries()).some(([, riskData]) => riskData.class === 1) && (
                                <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 1)
                                        .map(([line, riskData]) => (
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => closeModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <h4
                                                    className="line-label"
                                                    style={{ backgroundColor: getLineColor(line) }}
                                                >
                                                    {line}
                                                </h4>
                                            </div>
                                        ))}
                                </div>
                            )}
                            {Array.from(riskLines.entries()).some(([, riskData]) => riskData.class === 0) && (
                                <div className="risk-grid-item">
                                    {Array.from(riskLines.entries())
                                        .filter(([, riskData]) => riskData.class === 0)
                                        .map(([line, riskData]) => (
                                            <div
                                                key={line}
                                                className={`risk-line risk-level-${riskData.class}`}
                                                onClick={() => closeModal()}
                                            >
                                                <img
                                                    src={`/icons/risk-${riskData.class}.svg`}
                                                    alt="Icon to show risk level"
                                                />
                                                <h4
                                                    className="line-label"
                                                    style={{ backgroundColor: getLineColor(line) }}
                                                >
                                                    {line}
                                                </h4>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </section>
                </section>
            )}
            {currentTab === 'lines' && (
                <section className="list-modal">
                    <h2>{t('ReportsModal.topLines')}</h2>
                    <p>{t('ReportsModal.past24Hours')}</p>
                    <ResponsiveContainer width="100%" height={getChartData.length * (34 + 12)}>
                        <BarChart data={getChartData} layout="vertical">
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="line"
                                width={40}
                                interval={0}
                                axisLine={false}
                                tickLine={false}
                                tick={{
                                    fontSize: 16,
                                    fontWeight: 800,
                                    fill: isLightTheme ? '#000' : '#fff',
                                    dx: -5,
                                }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar
                                dataKey="reports"
                                barSize={34}
                                radius={[4, 4, 4, 4]}
                                fill="#7e5330"
                                name="reports"
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                shape={(props: any) => {
                                    const { x, y, width, height } = props
                                    const line = props.payload.line
                                    const color = getLineColor(line)
                                    return <rect x={x} y={y} width={width} height={height} fill={color} rx={4} ry={4} />
                                }}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </section>
            )}
            {currentTab === 'stations' && (
                <section className="list-modal">
                    <h2>{t('ReportsModal.topStations')}</h2>
                    <p>{t('ReportsModal.past24Hours')}</p>
                    {ticketInspectorList.map((ticketInspector) => (
                        <ReportItem
                            key={ticketInspector.station.id + ticketInspector.timestamp}
                            ticketInspector={ticketInspector}
                            currentTime={currentTime}
                        />
                    ))}
                </section>
            )}
        </div>
    )
}

export default ReportsModal

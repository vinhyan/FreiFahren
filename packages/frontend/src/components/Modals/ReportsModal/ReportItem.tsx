import React from 'react'
import { useTranslation } from 'react-i18next'

import { MarkerData } from 'src/utils/types'
import { useElapsedTimeMessage } from 'src/hooks/Messages'
import { getLineColor } from 'src/utils/uiUtils'
const ReportItem: React.FC<{ ticketInspector: MarkerData; currentTime: number }> = ({
    ticketInspector,
    currentTime,
}) => {
    const { t } = useTranslation()
    const inspectorTimestamp = new Date(ticketInspector.timestamp).getTime()
    const elapsedTime = Math.floor((currentTime - inspectorTimestamp) / (60 * 1000)) // Convert to minutes
    const elapsedTimeMessage = useElapsedTimeMessage(elapsedTime, ticketInspector.isHistoric)

    return (
        <div key={ticketInspector.station.id + ticketInspector.timestamp} className="report-item">
            <div className="align-child-on-line">
                {ticketInspector.line && (
                    <h4 className="line-label" style={{ backgroundColor: getLineColor(ticketInspector.line) }}>
                        {ticketInspector.line}
                    </h4>
                )}
                <h4>{ticketInspector.station.name}</h4>
                <p>{elapsedTimeMessage}</p>
            </div>
            <div>
                <p>
                    {ticketInspector.direction.name && (
                        <>
                            {t('MarkerModal.direction')}: <span>{ticketInspector.direction.name}</span>
                        </>
                    )}
                </p>
            </div>
        </div>
    )
}

export default ReportItem

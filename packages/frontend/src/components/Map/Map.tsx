import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react'
import { LngLatBoundsLike, LngLatLike, MapRef, ViewStateChangeEvent } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

import MarkerContainer from './Markers/MarkerContainer'
import LocationMarker from './Markers/Classes/LocationMarker/LocationMarker'
import StationLayer from './MapLayers/StationLayer/StationLayer'
import RiskLineLayer from './MapLayers/LineLayer/RiskLineLayer'
import RegularLineLayer from './MapLayers/LineLayer/RegularLineLayer'
import { convertStationsToGeoJSON } from '../../utils/mapUtils'
import { useRiskData } from '../../contexts/RiskDataContext'
import { useLocation } from '../../contexts/LocationContext'
import { useStationsAndLines } from '../../contexts/StationsAndLinesContext'
import { useETagCache } from '../../hooks/useETagCaching'

import './Map.css'

const Map = lazy(() => import('react-map-gl/maplibre'))

interface FreifahrenMapProps {
    formSubmitted: boolean
    isFirstOpen: boolean
    currentColorTheme: string
    isRiskLayerOpen: boolean
    onRotationChange: (bearing: number) => void
}

const berlinViewPosition: { lng: number; lat: number } = { lng: 13.388, lat: 52.5162 }
const github_icon = `${process.env.PUBLIC_URL}/icons/github.svg`
const instagram_icon = `${process.env.PUBLIC_URL}/icons/instagram.svg`

const FreifahrenMap: React.FC<FreifahrenMapProps> = ({
    formSubmitted,
    isFirstOpen,
    currentColorTheme,
    isRiskLayerOpen,
    onRotationChange,
}) => {
    const SouthWestBounds: LngLatLike = { lng: 12.8364646484805, lat: 52.23115511676795 }
    const NorthEastBounds: LngLatLike = { lng: 14.00044556529124, lat: 52.77063424239867 }
    const maxBounds: LngLatBoundsLike = [SouthWestBounds, NorthEastBounds]

    const { data: lineSegments, error: segmentsError } = useETagCache<GeoJSON.FeatureCollection<GeoJSON.LineString>>({
        endpoint: '/lines/segments',
        storageKeyPrefix: 'segments',
        onError: (error) => {
            console.error('Error loading lines GeoJSON', error)
        },
    })

    if (segmentsError) {
        console.error('Error loading lines GeoJSON', segmentsError)
    }

    const map = useRef<MapRef>(null)
    const { allStations } = useStationsAndLines()
    const stationGeoJSON = convertStationsToGeoJSON(allStations)

    const { userPosition, initializeLocationTracking } = useLocation()
    useEffect(() => {
        if (!isFirstOpen) {
            initializeLocationTracking()
        }
    }, [isFirstOpen, initializeLocationTracking])

    const textColor = currentColorTheme === 'light' ? '#000' : '#fff'

    // preload colors before risklayer component mounts to instantly show the highlighted segments
    const { segmentRiskData, refreshRiskData } = useRiskData()

    const hasRefreshed = useRef(false) // To prevent refreshing on every render
    useEffect(() => {
        if (isFirstOpen && !hasRefreshed.current) {
            // Refresh or load risk data on initial open
            refreshRiskData()
            hasRefreshed.current = true
        }
    }, [isFirstOpen, refreshRiskData])

    const handleRotate = useCallback(
        (evt: ViewStateChangeEvent) => {
            onRotationChange(evt.viewState.bearing)
        },
        [onRotationChange]
    )

    return (
        <div id="map-container" data-testid="map-container">
            <Suspense fallback={<div>Loading...</div>}>
                <Map
                    reuseMaps
                    data-testid="map"
                    ref={map}
                    id="map"
                    initialViewState={{
                        longitude: berlinViewPosition.lng,
                        latitude: berlinViewPosition.lat,
                        zoom: 11,
                    }}
                    maxZoom={14}
                    minZoom={10}
                    maxBounds={maxBounds}
                    onRotate={handleRotate}
                    mapStyle={
                        currentColorTheme === 'light'
                            ? `https://api.jawg.io/styles/359ec2e4-39f7-4fb5-8e3a-52037d043f96.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`
                            : `https://api.jawg.io/styles/848dfeff-2d26-4044-8b83-3b1851256e3d.json?access-token=${process.env.REACT_APP_JAWG_ACCESS_TOKEN}`
                    }
                >
                    {!isFirstOpen && <LocationMarker userPosition={userPosition} />}
                    <MarkerContainer
                        isFirstOpen={isFirstOpen}
                        formSubmitted={formSubmitted}
                        userPosition={userPosition}
                    />
                    <StationLayer stations={stationGeoJSON} textColor={textColor} />
                    {isRiskLayerOpen ? (
                        <RiskLineLayer
                            preloadedRiskData={segmentRiskData}
                            lineSegments={lineSegments}
                            textColor={textColor}
                        />
                    ) : (
                        <RegularLineLayer lineSegments={lineSegments} textColor={textColor} />
                    )}
                </Map>
            </Suspense>
            <div className="social-media">
                <a href="https://github.com/FreiFahren/FreiFahren" target="_blank" rel="noopener noreferrer">
                    <img src={github_icon} alt="GitHub" />
                </a>
                <a href="https://www.instagram.com/frei.fahren/" target="_blank" rel="noopener noreferrer">
                    <img src={instagram_icon} alt="Instagram" />
                </a>
            </div>
            <div className="map-attribution">
                <a href="https://www.jawg.io/" target="_blank" rel="noopener noreferrer">
                    © JawgMaps
                </a>{' '}
                |
                <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
                    © OSM contributors
                </a>
            </div>
        </div>
    )
}

export default FreifahrenMap

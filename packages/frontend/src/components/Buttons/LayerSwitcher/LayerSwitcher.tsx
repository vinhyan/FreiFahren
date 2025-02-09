import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import './LayerSwitcher.css'
import Backdrop from '../../../../src/components/Miscellaneous/Backdrop/Backdrop'

interface LayerSwitcherProps {
    changeLayer: (layer: string) => void
    isRiskLayerOpen: boolean
}

const LayerSwitcher: React.FC<LayerSwitcherProps> = ({ changeLayer, isRiskLayerOpen }) => {
    const { t } = useTranslation()
    const [areLayerOptionsVisible, setAreLayerOptionsVisible] = useState(false)

    const closeModalAndHighlightSelectedLayer = useCallback(
        async (selectedLayer: string) => {
            changeLayer(selectedLayer)
            setAreLayerOptionsVisible(false)
        },
        [changeLayer]
    )

    return (
        <>
            <button
                className="layer-switcher small-button align-child-on-line"
                onClick={() => setAreLayerOptionsVisible(!areLayerOptionsVisible)}
                aria-label="Button to open the layer switcher"
            >
                <p>{t('LayerSwitcher.mode')}</p>
                <img src={process.env.PUBLIC_URL + '/icons/layers.svg'} alt="Layers" />
            </button>
            {areLayerOptionsVisible && (
                <>
                    <Backdrop onClick={() => setAreLayerOptionsVisible(false)} BackgroundColor={'rgba(0, 0, 0, 0)'} />
                </>
            )}
            <div
                className={`layer-options small-button align-child-on-line ${areLayerOptionsVisible ? 'visible' : ''}`}
            >
                <div
                    {...(areLayerOptionsVisible ? { onClick: () => closeModalAndHighlightSelectedLayer('risk') } : {})}
                >
                    <img
                        src={process.env.PUBLIC_URL + '/icons/risk.png'}
                        alt="Showing how the risk layer looks like"
                        className={isRiskLayerOpen ? 'active' : ''}
                        draggable={areLayerOptionsVisible}
                    />
                    <p>{t('LayerSwitcher.risk')}</p>
                </div>
                <div
                    {...(areLayerOptionsVisible ? { onClick: () => closeModalAndHighlightSelectedLayer('line') } : {})}
                >
                    <img
                        src={process.env.PUBLIC_URL + '/icons/lines.png'}
                        alt="Showing how the line layer looks like"
                        className={isRiskLayerOpen ? '' : 'active'}
                        draggable={areLayerOptionsVisible}
                    />
                    <p>{t('LayerSwitcher.lines')}</p>
                </div>
            </div>
        </>
    )
}

export default LayerSwitcher

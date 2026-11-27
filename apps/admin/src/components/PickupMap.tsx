import 'leaflet/dist/leaflet.css'
import { latLngBounds } from 'leaflet'
import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap as useLeafletMap } from 'react-leaflet'
import { useMap } from '../api/hooks'
import { useT } from '../lib/i18n'
import { Button, ErrorBox, Loading } from './ui'

const DHAKA: [number, number] = [23.78, 90.4]
const COLORS = { open: '#FFC72C', overdue: '#A63D16', collector: '#0B7A5C', busy: '#13304A' }
const LEGEND = (c: string, b?: string) => ({ ['--c' as string]: c, ['--b' as string]: b ?? 'transparent' })

/**
 * A1 map: open requests (yellow, red when waiting too long) and online collectors (green, navy when on a pickup).
 * OpenStreetMap tiles through Leaflet; no API key. Zoom and fade animations are off (version 1: no animation). Refreshes every 30 seconds and on live events.
 */
export function PickupMap({ onOpen }: { onOpen: (pickupId: string) => void }) {
  const { t } = useT()
  const map = useMap()
  const [fitRequest, setFitRequest] = useState(0)
  const points: [number, number][] = map.data
    ? [...map.data.requests.map((r) => [r.lat, r.lng] as [number, number]), ...map.data.collectors.map((c) => [c.lat, c.lng] as [number, number])]
    : []
  return (
    <section className="card" aria-labelledby="map-title">
      <div className="card-head">
        <h2 id="map-title" style={{ fontFamily: 'inherit', fontSize: 15 }}>{t('map')}</h2>
        {points.length > 0 ? (
          <Button small variant="link" icon="pin" onClick={() => setFitRequest((n) => n + 1)}>
            {t('mapFitAll')}
          </Button>
        ) : null}
      </div>
      {map.isPending ? (
        <Loading />
      ) : map.isError ? (
        <ErrorBox error={map.error} onRetry={() => void map.refetch()} />
      ) : (
        <div className="map">
          <MapContainer center={DHAKA} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false}>
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <FitToPoints points={points} request={fitRequest} />
            {map.data.requests.map((r) => (
              <CircleMarker
                key={r.pickupId}
                center={[r.lat, r.lng]}
                radius={9}
                pathOptions={{ color: '#13304A', weight: 2, fillColor: r.overdue ? COLORS.overdue : COLORS.open, fillOpacity: 0.95 }}
                eventHandlers={{ click: () => onOpen(r.pickupId) }}
              >
                <Tooltip>{`${r.displayNo} · ${r.area}`}</Tooltip>
              </CircleMarker>
            ))}
            {map.data.collectors.map((c) => (
              <CircleMarker
                key={c.userId}
                center={[c.lat, c.lng]}
                radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: c.busy ? COLORS.busy : COLORS.collector, fillOpacity: 1 }}
              >
                <Tooltip>{c.name ?? t('unnamed')}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
      <div className="legend">
        <span style={LEGEND(COLORS.open, COLORS.busy)}>{t('legendOpen')}</span>
        <span style={LEGEND(COLORS.overdue)}>{t('legendOverdue')}</span>
        <span style={LEGEND(COLORS.collector)}>{t('legendCollector')}</span>
        <span style={LEGEND(COLORS.busy)}>{t('legendBusy')}</span>
      </div>
    </section>
  )
}

/**
 * Zooms to show every request and collector: once when the first points arrive, and again on "Show all".
 * The 30-second refreshes do not move the map, so an admin who zoomed in stays where they are.
 */
function FitToPoints({ points, request }: { points: [number, number][]; request: number }) {
  const map = useLeafletMap()
  const fitted = useRef(-1)
  useEffect(() => {
    if (points.length === 0 || fitted.current === request) return
    fitted.current = request
    if (points.length === 1) map.setView(points[0], 15)
    else map.fitBounds(latLngBounds(points), { padding: [32, 32], maxZoom: 15 })
  }, [map, points, request])
  return null
}

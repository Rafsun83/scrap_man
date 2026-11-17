import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { useMap } from '../api/hooks'
import { useT } from '../lib/i18n'
import { ErrorBox, Loading } from './ui'

const DHAKA: [number, number] = [23.78, 90.4]
const COLORS = { open: '#FFC72C', overdue: '#A63D16', collector: '#0B7A5C', busy: '#13304A' }

/**
 * A1 map: open requests (yellow, red when waiting too long) and online collectors (green, navy when on a pickup).
 * OpenStreetMap tiles through Leaflet; no API key. Refreshes every 30 seconds and on live events.
 */
export function PickupMap({ onOpen }: { onOpen: (pickupId: string) => void }) {
  const { t } = useT()
  const map = useMap()
  return (
    <section className="panel" aria-labelledby="map-title">
      <h2 id="map-title">{t('map')}</h2>
      {map.isPending ? (
        <Loading />
      ) : map.isError ? (
        <ErrorBox error={map.error} onRetry={() => void map.refetch()} />
      ) : (
        <div className="map">
          <MapContainer center={DHAKA} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
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
        <span style={{ ['--c' as string]: COLORS.open }}>{t('legendOpen')}</span>
        <span style={{ ['--c' as string]: COLORS.overdue }}>{t('legendOverdue')}</span>
        <span style={{ ['--c' as string]: COLORS.collector }}>{t('legendCollector')}</span>
        <span style={{ ['--c' as string]: COLORS.busy }}>{t('legendBusy')}</span>
      </div>
    </section>
  )
}

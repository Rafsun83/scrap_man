import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Gate } from './components/Gate'

/** Each page loads on first visit, so the map (Leaflet) only downloads with Live pickups. */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Gate />,
    children: [
      { index: true, element: <Navigate to="/pickups" replace /> },
      { path: 'pickups', lazy: () => import('./pages/Pickups').then((m) => ({ Component: m.PickupsPage })) },
      { path: 'rates', lazy: () => import('./pages/Rates').then((m) => ({ Component: m.RatesPage })) },
      { path: 'collectors', lazy: () => import('./pages/Collectors').then((m) => ({ Component: m.CollectorsPage })) },
      { path: 'disputes', lazy: () => import('./pages/Disputes').then((m) => ({ Component: m.DisputesPage })) },
      { path: 'users', lazy: () => import('./pages/Users').then((m) => ({ Component: m.UsersPage })) },
      { path: '*', element: <Navigate to="/pickups" replace /> },
    ],
  },
]

export const router = createBrowserRouter(routes)

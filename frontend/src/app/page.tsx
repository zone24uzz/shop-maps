import { Dashboard } from '@/components/dashboard/Dashboard';

// Server Component: renders the static shell. All interactivity lives below the
// `Dashboard` client boundary, and the Leaflet map loads in the browser only.
export default function HomePage() {
  return <Dashboard />;
}

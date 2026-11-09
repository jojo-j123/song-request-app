import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Spinner } from './components/ui';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Guest = lazy(() => import('./pages/Guest'));
const Display = lazy(() => import('./pages/Display'));
const Admin = lazy(() => import('./pages/Admin'));
const DJ = lazy(() => import('./pages/DJ'));

function Loading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-ink">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  );
}

function ShortGuest() {
  const { eventId } = useParams();
  return <Navigate to={`/guest/${eventId}`} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/guest/:eventId" element={<Guest />} />
        <Route path="/g/:eventId" element={<ShortGuest />} />
        <Route path="/display/:eventId" element={<Display />} />
        <Route path="/leaderboard/:eventId" element={<Display forcedMode="leaderboard" />} />
        <Route path="/request-wall/:eventId" element={<Display forcedMode="wall" />} />
        <Route path="/admin/:eventId" element={<Admin />} />
        <Route path="/dj/:eventId" element={<DJ />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

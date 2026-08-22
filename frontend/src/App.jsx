import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import { AuthProvider } from '@/auth/AuthContext';
import RequireAuth from '@/auth/RequireAuth';
import LandingOrRooms from '@/pages/LandingOrRooms';
import Login from '@/pages/Login';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import Processing from '@/pages/Processing';
import Editor from '@/pages/Editor';
import CatalogAdmin from '@/pages/CatalogAdmin';

/**
 * Two tiers of route: `/` and `/login` are public, everything else sits behind RequireAuth.
 *
 * `/` isn't the project grid any more — the grid moved to `/rooms` so that the front door can
 * be a landing page for people who don't have an account yet. LandingOrRooms is what keeps
 * that from costing signed-in users a wasted stop.
 */
function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<LandingOrRooms />} />
          <Route path="/login" element={<Login />} />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/rooms" element={<Home />} />
              <Route path="/catalog" element={<CatalogAdmin />} />
            </Route>
            <Route path="/upload" element={<Upload />} />
            <Route path="/processing/:projectId" element={<Processing />} />
            <Route path="/editor/:projectId" element={<Editor />} />
          </Route>

          <Route path="*" element={<PageNotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import PageNotFound from './lib/PageNotFound';
import ScrollToTop from './components/ScrollToTop';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Upload from '@/pages/Upload';
import Processing from '@/pages/Processing';
import Editor from '@/pages/Editor';
import CatalogAdmin from '@/pages/CatalogAdmin';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<CatalogAdmin />} />
        </Route>
        <Route path="/upload" element={<Upload />} />
        <Route path="/processing/:projectId" element={<Processing />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

export default App;

import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, Home as HomeIcon, LayoutGrid, SlidersHorizontal } from 'lucide-react';
import { Home } from './pages/Home';
import { ProjectPage } from './pages/ProjectPage';
import { Configurator, ConfiguratorIndex } from './pages/Configurator';
import { Tips } from './pages/Tips';

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <>
      <ScrollTop />
      <header className="site-header">
        <div className="wrap">
          <Link to="/" className="brand" aria-label="miTaller, inicio">
            mi<span>Taller</span>
          </Link>
          <nav className="nav" aria-label="Principal">
            <NavLink to="/" end><HomeIcon size={20} aria-hidden />Inicio</NavLink>
            <NavLink to="/plantillas"><LayoutGrid size={20} aria-hidden />Plantillas</NavLink>
            <NavLink to="/crear"><SlidersHorizontal size={20} aria-hidden />Configurador</NavLink>
            <NavLink to="/consejos"><BookOpen size={20} aria-hidden />Consejos</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/plantillas" element={<Home only="plantillas" />} />
          <Route path="/proyecto/:id" element={<ProjectPage />} />
          <Route path="/crear" element={<ConfiguratorIndex />} />
          <Route path="/crear/:id" element={<Configurator />} />
          <Route path="/consejos" element={<Tips />} />
          <Route path="/consejos/:area" element={<Tips />} />
          <Route path="*" element={<div className="wrap empty"><h1>Aquí no hay nada</h1><p>La página que buscas no existe.</p><Link className="btn primary" to="/">Volver al inicio</Link></div>} />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p><strong>miTaller</strong> · Manuales paso a paso de carpintería y soldadura. Las medidas y técnicas son orientativas: comprueba siempre tu material y trabaja con el equipo de protección adecuado.</p>
          <p><Link to="/consejos">Consejos y fuentes</Link></p>
        </div>
      </footer>
    </>
  );
}

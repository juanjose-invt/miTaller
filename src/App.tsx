import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, GraduationCap, Home as HomeIcon, LayoutGrid, SlidersHorizontal, Warehouse } from 'lucide-react';
import { Home, Templates } from './pages/Home';
import { ProjectPage } from './pages/ProjectPage';
import { Configurator, ConfiguratorIndex } from './pages/Configurator';
import { Tips } from './pages/Tips';
import { MiTaller } from './pages/MiTaller';
import { Learn } from './pages/Learn';

// el modo libre se carga aparte: es una herramienta completa y no todo el mundo la abre
const freeMods = import.meta.glob<{ FreeMode: ComponentType }>('./pages/FreeMode.tsx');
const FreeMode = lazy(async () => {
  const load = freeMods['./pages/FreeMode.tsx'];
  return { default: load ? (await load()).FreeMode : () => <div className="wrap empty"><h1>Modo libre</h1><p>Esta herramienta no está disponible ahora mismo.</p></div> };
});

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
          <Link to="/" className="brand" aria-label="miTaller, inicio">mi<span>Taller</span></Link>
          <nav className="nav" aria-label="Principal">
            <NavLink to="/" end className="only-mobile"><HomeIcon size={20} aria-hidden />Inicio</NavLink>
            <NavLink to="/plantillas"><LayoutGrid size={20} aria-hidden />Plantillas</NavLink>
            <NavLink to="/crear" className={({ isActive }) => (isActive || location.hash.startsWith('#/libre') ? 'active' : '')}><SlidersHorizontal size={20} aria-hidden />Diseñar</NavLink>
            <NavLink to="/aprende"><GraduationCap size={20} aria-hidden />Aprende</NavLink>
            <NavLink to="/consejos" className="only-desktop"><BookOpen size={20} aria-hidden />Consejos</NavLink>
            <NavLink to="/mi-taller"><Warehouse size={20} aria-hidden />Mi taller</NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Suspense fallback={<div className="wrap empty"><p>Cargando…</p></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/plantillas" element={<Templates />} />
            <Route path="/proyecto/:id" element={<ProjectPage />} />
            <Route path="/crear" element={<ConfiguratorIndex />} />
            <Route path="/crear/:id" element={<Configurator />} />
            <Route path="/libre" element={<FreeMode />} />
            <Route path="/aprende" element={<Learn />} />
            <Route path="/consejos" element={<Tips />} />
            <Route path="/consejos/:area" element={<Tips />} />
            <Route path="/mi-taller" element={<MiTaller />} />
            <Route path="/mi-taller/:tab" element={<MiTaller />} />
            <Route path="*" element={<div className="wrap empty"><h1>Aquí no hay nada</h1><p>La página que buscas no existe.</p><Link className="btn primary" to="/">Volver al inicio</Link></div>} />
          </Routes>
        </Suspense>
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

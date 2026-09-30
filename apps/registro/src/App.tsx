import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import CapacitarPage from './pages/CapacitarPage'
import DashboardPage from './pages/DashboardPage'
import PersonerosPage from './pages/PersonerosPage'
import CapacitacionPage from './pages/CapacitacionPage'
import CredencialesPage from './pages/CredencialesPage'
import CentrosPage from './pages/CentrosPage'
import PanelLayout from './pages/panel/PanelLayout'
import PanelGeneral from './pages/panel/PanelGeneral'
import PanelCapacitaciones from './pages/panel/PanelCapacitaciones'
import Layout from './components/Layout'
import { rolNorm, ROL_LOCAL } from './lib/panel'
import type { User } from '@supabase/supabase-js'

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [esAdmin, setEsAdmin] = useState(false)
  // "Coordinador Regional" también es esAdmin (entra a /panel y /admin), pero su
  // destino post-login es /admin (panel completo, acotado a su depto) en vez de /panel.
  const [esCoordRegional, setEsCoordRegional] = useState(false)
  // Personero de Centro de Votación: entra directo a /panel (sin capacitación
  // obligatoria) pero ve SOLO su propio centro de votación ahí — no /admin,
  // que lista todos los personeros del ámbito.
  const [esPCV, setEsPCV] = useState(false)
  // Hasta que no se resuelva el rol del usuario logueado NO renderizamos las
  // rutas (si no, el redirect de /login se evalúa con esAdmin viejo y manda
  // al admin a /capacitate).
  const [rolListo, setRolListo] = useState(false)
  // Hay sesión guardada pero su perfil no existe (cuenta eliminada) o no se pudo
  // verificar: en /login se muestra el formulario en vez de redirigir.
  const [sinPerfil, setSinPerfil] = useState(false)

  useEffect(() => {
    let vivo = true
    // Supabase dispara onAuthStateChange no solo en login/logout, sino también
    // en cada refresco silencioso de token (típicamente al volver a una
    // pestaña que estuvo en segundo plano). Sin este control, cada uno de esos
    // refrescos reseteaba rolListo -> toda la app (panel, admin, capacítate)
    // se veía "reiniciar" al spinner aunque siguiera siendo el mismo usuario.
    let userIdAnterior: string | null = null

    // El perfil se busca por DNI: en cuentas importadas profiles.id != auth.users.id.
    const resolver = async (u: User | null, esCambioDeUsuario: boolean) => {
      if (esCambioDeUsuario) setRolListo(false)
      setUser(u)
      if (!u) { if (vivo) { setEsAdmin(false); setEsCoordRegional(false); setEsPCV(false); setRolListo(true) } ; return }
      // Mismo usuario que antes (solo se refrescó el token): el rol ya está
      // resuelto, no hace falta volver a consultarlo ni bloquear la pantalla.
      if (!esCambioDeUsuario) return
      const dni = (u.email ?? '').split('@')[0]
      let data: { rol: string } | null = null
      try {
        data = (await supabase.from('profiles').select('rol').eq('dni', dni).maybeSingle()).data
        if (!data) data = (await supabase.from('profiles').select('rol').eq('id', u.id).maybeSingle()).data
      } catch (e) {
        // Red caída o sesión inválida (p.ej. la cuenta fue eliminada desde otra
        // PC): se sigue sin rol en vez de quedar colgado en el spinner.
        console.error('No se pudo resolver el rol:', e)
      }
      if (!vivo) return
      setSinPerfil(!data)
      const rol = data?.rol || ''
      setEsAdmin(rol.includes('Administrador') || rol.includes('Coordinador'))
      setEsCoordRegional(rol === 'Coordinador Regional')
      setEsPCV(rolNorm(rol) === ROL_LOCAL)
      setRolListo(true)
    }

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null
      userIdAnterior = u?.id ?? null
      resolver(u, true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      const u = s?.user ?? null
      const cambio = (u?.id ?? null) !== userIdAnterior
      userIdAnterior = u?.id ?? null
      // Fuera del callback: consultar Supabase DENTRO de onAuthStateChange puede
      // dejar a la librería esperándose a sí misma (spinner infinito, visto al
      // renovar la sesión de una cuenta eliminada desde otra PC).
      setTimeout(() => resolver(u, cambio), 0)
    })
    // Red de seguridad: nunca más de 10 s en "cargando"; en el peor caso se ve el login.
    const tope = setTimeout(() => { if (vivo) { setRolListo(prev => { if (!prev) setSinPerfil(true); return true }) } }, 10_000)
    return () => { vivo = false; clearTimeout(tope); subscription.unsubscribe() }
  }, [])

  const Spinner = (
    <div className="min-h-screen flex items-center justify-center bg-[#c9e6f8]">
      <div className="w-8 h-8 border-2 border-[#00a3e8] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  // El gate de `rolListo` se aplica POR RUTA (no como early-return global antes
  // de <BrowserRouter>): un early-return global desmonta TODA la app -incluida
  // RegisterPage- cada vez que cambia el estado de auth. Como el registro ahora
  // autentica al usuario al instante (confirm email OFF), eso pasaba justo
  // después de registrarse y borraba la pantalla de éxito (token/clave) antes
  // de que el personero la viera. Las rutas públicas (/ y /registro) no
  // dependen de esAdmin/esCoordRegional, así que no necesitan esperar a `rolListo`.
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/" element={<RegisterPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/login" element={!rolListo ? Spinner : (!user || sinPerfil) ? <LoginPage /> : <Navigate to={esCoordRegional ? '/admin' : (esAdmin || esPCV) ? '/panel' : '/capacitate'} />} />

        {/* Página de capacitación para personeros registrados */}
        <Route path="/capacitate" element={!rolListo ? Spinner : user ? <CapacitarPage /> : <Navigate to="/login" />} />

        {/* Panel de coordinadores (completo) o Personero de Centro de Votación (solo su local) */}
        <Route path="/panel" element={!rolListo ? Spinner : !user ? <Navigate to="/login" /> : (esAdmin || esPCV) ? <PanelLayout /> : <Navigate to="/capacitate" />}>
          <Route index element={<PanelGeneral />} />
          <Route path="capacitaciones" element={<PanelCapacitaciones />} />
        </Route>

        {/* Panel admin clásico: solo Administrador / Coordinador */}
        <Route path="/admin" element={!rolListo ? Spinner : !user ? <Navigate to="/login" /> : esAdmin ? <Layout /> : <Navigate to="/capacitate" />}>
          <Route index element={<Navigate to="/admin/dashboard" />} />
          <Route path="dashboard"    element={<DashboardPage />} />
          <Route path="centros"      element={<CentrosPage />} />
          <Route path="personeros"   element={<PersonerosPage />} />
          <Route path="capacitacion" element={<CapacitacionPage />} />
          <Route path="credenciales" element={<CredencialesPage />} />
        </Route>

        {/* dashboard legacy redirect */}
        <Route path="/dashboard" element={<Navigate to="/admin/dashboard" />} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}

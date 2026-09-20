/**
 * Preload para que el `fetch` nativo de Node (usado por @supabase/supabase-js)
 * respete HTTPS_PROXY. Solo hace falta cuando se corren los scripts de este
 * directorio DENTRO de un entorno de Claude Code en la nube: ahí, la salida a
 * internet pasa por un proxy (para poder restringir/autorizar hosts como
 * *.supabase.co), pero el fetch nativo de Node no lee HTTPS_PROXY por su
 * cuenta y las requests salen directo — bloqueadas por la política de red.
 * En tu máquina local (o cualquier entorno sin ese proxy) esto no hace nada.
 *
 * Uso:
 *   node --import ./scripts/proxy_preload_claude_code_web.mjs scripts/importar_cali_ambito.mjs ...
 */
import { ProxyAgent, setGlobalDispatcher } from 'undici'
if (process.env.HTTPS_PROXY || process.env.https_proxy) {
  setGlobalDispatcher(new ProxyAgent(process.env.HTTPS_PROXY || process.env.https_proxy))
}

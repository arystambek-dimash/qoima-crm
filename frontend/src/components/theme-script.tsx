// Runs synchronously before hydration to apply the stored theme attribute.
// Reads zustand's persisted value from localStorage.
const SCRIPT = `(function(){try{var r=document.documentElement;var t='light';var raw=localStorage.getItem('qoima.theme');if(raw){var p=JSON.parse(raw);if(p&&p.state&&p.state.theme){t=p.state.theme;}}r.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='light';}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}

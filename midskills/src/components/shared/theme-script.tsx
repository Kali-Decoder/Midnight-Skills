export function ThemeScript() {
  const script = `(function(){try{var t=localStorage.getItem("midskills-theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

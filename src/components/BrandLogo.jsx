// MiAhorro Pocket logo. Renders both the dark- and light-background artwork and lets CSS
// show the one that matches the active theme ([data-theme] on <html>).
const SOURCES = {
  horizontal: ['/logo-horizontal.svg', '/logo-horizontal-light.svg'],
  icon:       ['/logo-icon.svg',       '/logo-icon-light.svg'],
};

export default function BrandLogo({ variant = 'horizontal', className = '' }) {
  const [dark, light] = SOURCES[variant];
  return (
    <>
      <img src={dark}  alt="MiAhorro Pocket" className={`${className} logo-on-dark`} />
      <img src={light} alt="" aria-hidden="true" className={`${className} logo-on-light`} />
    </>
  );
}

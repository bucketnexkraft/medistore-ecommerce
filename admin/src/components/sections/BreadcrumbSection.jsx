export default function BreadcrumbSection({ page }) {
  const title = String(page?.breadcrumb_title || page?.name || "").trim();
  const description = String(page?.breadcrumb_description || "").trim();

  if (!title) return null;

  return (
    <section className="ot-breadcrumb-area ot-breadcrumb-style p-relative">
      <div className="ot-breadcrumb-bg ot-breadcrumb-overlay" />
      <div className="container container-1226">
        <div className="row justify-content-center text-center">
          <div className="col-xl-7 col-lg-8">
            <h1 className="ot-breadcrumb-title ot-text-anime-3 z-index-2">{title}</h1>
            {description ? <p className="ot-breadcrumb-text">{description}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

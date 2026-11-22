import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_URL } from "../config/constants";
import HeaderStatic from "../components/layout/HeaderStatic";
import FooterSection from "../components/sections/FooterSection";
import BreadcrumbSection from "../components/sections/BreadcrumbSection";
import useLandingThemeAssets from "../hooks/useLandingThemeAssets";
import FullPageLoader from "../components/common/FullPageLoader";

export default function BlogCategory() {
  useLandingThemeAssets();

  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandColor, setBrandColor] = useState("#2f3a4c");
  const [menuItems, setMenuItems] = useState([]);
  const [data, setData] = useState(null);

  const apiUrl = useMemo(() => {
    const safeSlug = encodeURIComponent((slug || "").trim().toLowerCase());
    return `${API_URL}/landing/blog-categories/${safeSlug}`;
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settingsResponse, menuResponse, categoryResponse] = await Promise.all([
          fetch(`${API_URL}/landing/settings`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/landing/menu`, { headers: { Accept: "application/json" } }),
          fetch(apiUrl, { headers: { Accept: "application/json" } }),
        ]);

        if (!categoryResponse.ok) throw new Error(`Blog category failed with status ${categoryResponse.status}`);

        const settingsResult = settingsResponse.ok ? await settingsResponse.json() : null;
        const menuResult = menuResponse.ok ? await menuResponse.json() : null;
        const categoryResult = await categoryResponse.json();
        const settingsData = settingsResult?.data || {};

        if (mounted) {
          setLogoUrl(settingsData?.dark_logo_url || settingsData?.white_logo_url || "");
          setBrandColor(settingsData?.base_color || "#2f3a4c");
          setMenuItems(
            Array.isArray(menuResult?.data)
              ? menuResult.data.filter((item) => {
                  const title = String(item?.title || "").trim().toLowerCase();
                  const path = String(item?.path || "").trim().toLowerCase();
                  return !(title === "home" || path === "/" || path === "/home");
                })
              : []
          );
          setData(categoryResult?.data || null);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError("Blog category failed to load. Please try again.");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [apiUrl]);

  if (loading) {
    return <FullPageLoader brandColor={brandColor} />;
  }

  if (error || !data?.category) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600">{error || "Blog category not found."}</p>
        <div className="mt-4 flex gap-3">
          <Link to="/" className="btn btn-outline">Home</Link>
          <Link to="/blog" className="btn btn-primary">Blogs</Link>
        </div>
      </div>
    );
  }

  const category = data.category;
  const blogs = Array.isArray(data?.blogs) ? data.blogs : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const recentPosts = Array.isArray(data?.recent_posts) ? data.recent_posts : [];
  const breadcrumbPage = {
    breadcrumb_title: category?.name || "Blog Category",
    breadcrumb_description: `Articles filed under ${category?.name || "this category"}.`,
  };

  return (
    <div>
      <HeaderStatic logoUrl={logoUrl} brandColor={brandColor} menuItems={menuItems} />
      <BreadcrumbSection page={breadcrumbPage} />

      <section className="ot-blogpost-area ot-blog-inner-style ot-space">
        <div className="container">
          <div className="row">
            <div className="col-xl-8 col-lg-8">
              <div className="row g-4">
                {blogs.map((blog) => (
                  <div className="col-xl-6 col-md-6" key={blog.id}>
                    <article className="ot-blog-card h-100">
                      <div className="ot-blog-img ot-img-hover">
                        <Link to={blog?.url || "#"}>
                          <img src={blog?.image_url || "/images/default.jpeg"} alt={blog?.title || "blog"} />
                        </Link>
                      </div>
                      <div className="ot-blog-content soft-lavender">
                        <p className="ot-blog-category">{blog?.category?.name || category.name}</p>
                        <h3 className="ot-blog-title mb-15">
                          <Link to={blog?.url || "#"} className="ot-line-hover">
                            {blog?.title || ""}
                          </Link>
                        </h3>
                        <p className="ot-blog-text">{blog?.short_description || ""}</p>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
              {!blogs.length ? <p className="text-center mt-3">No blogs available in this category.</p> : null}
            </div>

            <div className="col-xl-4 col-lg-4 gx-0">
              <div className="sidebar-wrapp ot-sidebar-details">
                <div className="sidebar-widget theme-bg categorie-style mb-45">
                  <h3 className="sidebar-widget-title mb-30">Categories</h3>
                  <div className="sidebar-widget-categorie">
                    <ul>
                      {categories.map((item) => (
                        <li key={item.id}>
                          <Link to={item.url || "#"} className="d-flex align-items-center justify-content-between">
                            {item.name}
                            <span>({item.blogs_count || 0})</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="sidebar-widget sidebar-widget-rc mb-45">
                  <h3 className="sidebar-widget-title mb-30">Recent Posts</h3>
                  {recentPosts.map((post) => (
                    <div className="rc-post d-flex" key={post.id}>
                      <div className="rc-post-thumb ot-img-hover">
                        <Link to={post.url || "#"}>
                          <img src={post.image_url || "/images/default.jpeg"} alt={post.title || "post"} />
                        </Link>
                      </div>
                      <div className="rc-post-content">
                        <h3 className="rc-post-title">
                          <Link to={post.url || "#"} className="ot-line-hover">{post.title}</Link>
                        </h3>
                        <div className="rc-post-metabox d-flex justify-content-between align-items-center">
                          <div className="rc-post-meta">
                            <i className="flaticon-calendar rc-calender-icon" />
                            <span>{post.created_at || ""}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}

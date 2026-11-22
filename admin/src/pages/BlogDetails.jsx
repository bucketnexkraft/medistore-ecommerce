import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import { API_URL } from "../config/constants";
import HeaderStatic from "../components/layout/HeaderStatic";
import FooterSection from "../components/sections/FooterSection";
import BreadcrumbSection from "../components/sections/BreadcrumbSection";
import useLandingThemeAssets from "../hooks/useLandingThemeAssets";
import FullPageLoader from "../components/common/FullPageLoader";

export default function BlogDetails() {
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
    return `${API_URL}/landing/blogs/${safeSlug}`;
  }, [slug]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [settingsResponse, menuResponse, blogResponse] = await Promise.all([
          fetch(`${API_URL}/landing/settings`, { headers: { Accept: "application/json" } }),
          fetch(`${API_URL}/landing/menu`, { headers: { Accept: "application/json" } }),
          fetch(apiUrl, { headers: { Accept: "application/json" } }),
        ]);

        if (!blogResponse.ok) throw new Error(`Blog details failed with status ${blogResponse.status}`);

        const settingsResult = settingsResponse.ok ? await settingsResponse.json() : null;
        const menuResult = menuResponse.ok ? await menuResponse.json() : null;
        const blogResult = await blogResponse.json();

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
          setData(blogResult?.data || null);
          setError("");
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError("Blog failed to load. Please try again.");
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

  if (error || !data?.blog) {
    return (
      <div className="min-h-screen p-8">
        <p className="text-red-600">{error || "Blog not found."}</p>
        <div className="mt-4 flex gap-3">
          <Link to="/" className="btn btn-outline">Home</Link>
          <Link to="/login" className="btn btn-primary">Login</Link>
        </div>
      </div>
    );
  }

  const blog = data.blog;
  const recentPosts = Array.isArray(data?.recent_posts) ? data.recent_posts : [];
  const categories = Array.isArray(data?.categories) ? data.categories : [];
  const tags = Array.isArray(blog?.tags) ? blog.tags : [];
  const sanitizedDescription = DOMPurify.sanitize(blog?.description || "");
  const breadcrumbPage = {
    breadcrumb_title: blog?.title || "Blog Details",
    breadcrumb_description: blog?.short_description || "",
  };

  return (
    <div>
      <HeaderStatic logoUrl={logoUrl} brandColor={brandColor} menuItems={menuItems} />
      <BreadcrumbSection page={breadcrumbPage} />

      <section className="ot-blogpost-area ot-blog-inner-style ot-space">
        <div className="container">
          <div className="row">
            <div className="col-xl-8 col-lg-8">
              <div className="blog-wrapper me-xl-3 mb-50">
                <article className="blog-details-item p-0">
                  <div className="blog-details-img mb-50">
                    <img src={blog?.image_url || "/images/default.jpeg"} alt={blog?.title || "Blog"} />
                  </div>
                  <h3 className="blog-details-title mb-20">{blog?.title || ""}</h3>
                  <div className="blog-reviewer-box">
                    <div className="blog-details-info">
                      <div className="blog-reviewer-content">
                        <h3 className="blog-reviewer-name">Blog Team</h3>
                        <div className="blog-details-meta-box mb-15">
                          <span className="blog-details-meta">
                            <i className="flaticon-clock" /> {blog?.created_at || ""}
                          </span>
                          <span className="blog-details-meta">
                            <i className="flaticon-folder" /> {blog?.category?.name || "General"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <div className="blog-details-content">
                  {blog?.short_description ? <p className="blog-details-text">{blog.short_description}</p> : null}
                  <div dangerouslySetInnerHTML={{ __html: sanitizedDescription }} />
                </div>
              </div>
            </div>

            <div className="col-xl-4 col-lg-4 gx-0">
              <div className="sidebar-wrapp ot-sidebar-details">
                <div className="sidebar-widget theme-bg categorie-style mb-45">
                  <h3 className="sidebar-widget-title mb-30">Categories</h3>
                  <div className="sidebar-widget-categorie">
                    <ul>
                      {categories.map((category) => (
                        <li key={category.id}>
                          <a href={category.url || "#"} className="d-flex align-items-center justify-content-between">
                            {category.name}
                            <span>({category.blogs_count || 0})</span>
                          </a>
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
                        <a href={post.url || "#"}>
                          <img src={post.image_url || "/images/default.jpeg"} alt={post.title || "post"} />
                        </a>
                      </div>
                      <div className="rc-post-content">
                        <h3 className="rc-post-title">
                          <a href={post.url || "#"} className="ot-line-hover">{post.title}</a>
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

                {!!tags.length && (
                  <div className="sidebar-widget sidebar-tags mb-45">
                    <h3 className="sidebar-widget-title mb-30">Popular Tags</h3>
                    <div className="sidebar-widget-content theme-bg">
                      <div className="tagcloud">
                        {tags.map((tag, idx) => (
                          <span className="tag" key={`tag-${idx}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}

import { useEffect, useState } from "react";
import { API_URL } from "../../config/constants";

export default function BlogSection({ section, isHome = false }) {
  const content = section?.content || {};
  const [blogs, setBlogs] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadBlogs = async () => {
      try {
        const query = new URLSearchParams({
          home: isHome ? "1" : "0",
          limit: isHome ? "6" : "12",
        });
        const response = await fetch(`${API_URL}/landing/sections/blog?${query.toString()}`, {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Blog section failed: ${response.status}`);
        const result = await response.json();
        if (mounted) {
          setBlogs(Array.isArray(result?.data?.blogs) ? result.data.blogs : []);
        }
      } catch (error) {
        if (mounted) setBlogs([]);
      }
    };

    loadBlogs();
    return () => {
      mounted = false;
    };
  }, [isHome]);

  return (
    <section className="ot-blog-area ot-blog-inner-style ot-space-bottom" data-section="blog">
      <div className="container">
        {isHome ? (
          <div className="row">
            <div className="col-xl-8 col-lg-8">
              <div className="ot-title-area ot-blog-titlebox mb-45">
                <p className="ot-sec-text ot-text-anime-1">{content?.subheading || ""}</p>
                <h3 className="ot-sec-title fw-6 ot-text-anime-3">{content?.heading || ""}</h3>
              </div>
            </div>
            <div className="col-xl-4 col-lg-4">
              <div className="ot-blog-btn text-lg-end">
                <a href={content?.button_link || "/blog"} className="ot-btn-primary">
                  {content?.button_text || "Read all blogs"}
                </a>
              </div>
            </div>
          </div>
        ) : null}

        <div className="blog-wrapp">
          <div className="row g-4 justify-content-center">
            {blogs.map((blog, index) => (
              <div className={isHome ? "col-xl-4 col-lg-6" : "col-xl-6 col-lg-6"} key={`blog-${blog?.id || index}`}>
                <div className={isHome ? "ot-blog-item" : "ot-blog-card"}>
                  <div className={isHome ? "ot-blog-thumb" : "ot-blog-img ot-img-hover"}>
                    <a href={blog?.url || "#"}>
                      <img src={blog?.image_url || "/images/default.jpeg"} alt={blog?.title || "blog"} />
                    </a>
                  </div>

                  <div className={isHome ? "ot-blog-content glass-box" : "ot-blog-content soft-lavender"}>
                    {!isHome ? <p className="ot-blog-category">{blog?.category?.name || "Blog"}</p> : null}
                    <h3 className="ot-blog-title mb-15">
                      <a href={blog?.url || "#"} className="ot-line-hover">
                        {blog?.title || ""}
                      </a>
                    </h3>
                    {isHome ? (
                      <div className="ot-blog-metabox mt-15">
                        <p className="ot-blog-meta">{blog?.created_at || ""}</p>
                      </div>
                    ) : (
                      <p className="ot-blog-text">{blog?.short_description || ""}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {!blogs.length ? <p className="text-center mt-3">No blogs available.</p> : null}
        </div>
      </div>
    </section>
  );
}


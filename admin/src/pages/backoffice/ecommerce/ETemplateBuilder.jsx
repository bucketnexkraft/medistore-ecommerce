import { useEffect, useMemo, useState } from "react";
import { useLayoutEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  PiArrowLeft,
  PiFloppyDisk,
  PiLink,
  PiList,
  PiDotsSixVertical,
  PiNotePencil,
  PiPlus,
  PiRows,
  PiCheck,
  PiTrash,
} from "react-icons/pi";
import SectionConfigEditor, { customSectionSchema, mergeSectionSchemaConfig, sectionSchemaDefaults } from "../../../components/common/SectionConfigEditor";
import {
  getETemplateOptions,
  getETemplateBuilder,
  updateETemplateBuilder,
} from "../../../api/backoffice/ecommerceTemplates";
import { uploadStorefrontSectionMedia } from "../../../api/storefrontBuilder";
import {
  buildStorefrontActionLinkState,
  STOREFRONT_INTERNAL_ROUTE_OPTIONS,
  STOREFRONT_LINK_TYPES,
} from "../../../utils/storefrontLinks";

const SECTION_MODES = [
  { value: "template", label: "Template" },
  { value: "rich_text", label: "Rich Text" },
  { value: "sql_query", label: "SQL Query" },
  { value: "query_json", label: "JSON Query" },
];

const ACTION_PLACEMENT_ORDER = ["header", "footer"];

const ACTION_PLACEMENT_LABELS = {
  header: "Header menu",
  footer: "Footer menu",
};

const PAGE_ROUTE_MODE_OPTIONS = [
  { value: "custom_url", label: "Custom URL" },
  { value: "internal_route", label: "Existing Route" },
];

const PAGE_INTERNAL_ROUTE_SET = new Set(
  STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => option.value)
);

const inputClassName =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const textareaClassName =
  "min-h-[132px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

const slugifyValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/_+/g, "_")
    .replace(/^-+|-+$/g, "");

const routeKeyToPageSlug = (routeKey) => {
  const normalizedRoute = String(routeKey || "").trim();

  if (normalizedRoute === "/") {
    return "home";
  }

  return slugifyValue(normalizedRoute.replace(/^\/+/, ""));
};

const routeKeyToThemePageKey = (routeKey, slug = "") => {
  const normalizedRoute = String(routeKey || "").trim().toLowerCase();
  if (normalizedRoute === "/" || normalizedRoute === "home") return "home";

  const normalized = slugifyValue(normalizedRoute.replace(/^\/+/, "") || slug);
  if (normalized === "checkout-one" || normalized === "checkout-two") return "checkout";
  if (normalized.startsWith("user-dashboard")) return "user-dashboard";

  return normalized;
};

const createId = (prefix) => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDefaultBuilder = () => ({
  version: 1,
  default_page_id: null,
  pages: [],
  sections: [],
  actions: [],
  settings: {
    header_placeholder: "#HEADER_LINKS#",
    token_pattern_hint: "#privacy_policy#",
    load_actions_on_boot: true,
  },
  meta: {
    template_variants: [],
    component_options: {},
  },
});

const createBuilderSavePayload = (builder = {}) => ({
  version: builder.version || 1,
  default_page_id: builder.default_page_id || null,
  pages: Array.isArray(builder.pages) ? builder.pages : [],
  sections: Array.isArray(builder.sections) ? builder.sections : [],
  actions: Array.isArray(builder.actions) ? builder.actions : [],
  settings: builder.settings && typeof builder.settings === "object" ? builder.settings : {},
});

const createBlankPage = () => ({
  id: createId("page"),
  name: "New Page",
  slug: "new-page",
  route_mode: "custom_url",
  route_key: "",
});

const createBlankSection = (pageId, index) => ({
  id: createId("section"),
  page_id: pageId,
  name: `section_${index + 1}`,
  title: "New Section",
  subtitle: "",
  newsletter_title: "",
  newsletter_text: "",
  layout: "template",
  variant: "hero",
  preset_key: "",
  component_key: "storefront-hero",
  category_refs: [],
  order: index + 1,
  query_sql: "",
  query_json: "",
  rich_text_html: "",
  config: { schema_version: 1, content: {}, data: {}, style: {} },
  editor_schema: null,
});

const createBlankAction = (pageId, sectionId = "", placement = "header", sortOrder = 1) => ({
  id: createId("action"),
  page_id: pageId,
  section_id: sectionId,
  name: placement === "footer" ? "New Footer Segment" : "New Action",
  slug: placement === "footer" ? "new-footer-segment" : "new-action",
  expression: "",
  link_type: "custom_path",
  route_key: "",
  target_page_id: "",
  target_page_slug: "",
  target_page_route_mode: "custom_url",
  target_page_route_key: "",
  label: "",
  placement: placement === "footer" ? "footer" : "header",
  footer_group: "",
  sort_order: sortOrder,
});

const normalizeActionPlacement = (value) => {
  const placement = String(value || "").trim().toLowerCase();

  return placement === "footer" ? "footer" : "header";
};

const sortActionsForBuilder = (items = []) =>
  [...items].sort((a, b) => {
    const placementDelta =
      ACTION_PLACEMENT_ORDER.indexOf(normalizeActionPlacement(a.placement)) -
      ACTION_PLACEMENT_ORDER.indexOf(normalizeActionPlacement(b.placement));

    if (placementDelta !== 0) {
      return placementDelta;
    }

    const orderDelta = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
    if (orderDelta !== 0) {
      return orderDelta;
    }

    return String(a.id || "").localeCompare(String(b.id || ""));
  });

const normalizeFooterGroupKey = (value) =>
  slugifyValue(value || "") || "footer-group";

const getFooterGroupDisplayTitle = (groupKey) =>
  String(groupKey || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();

const collectActionTargetPageIds = (items = []) =>
  items
    .map((action) => String(action.target_page_id || "").trim())
    .filter(Boolean);

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="mb-2 flex min-h-[24px] items-center gap-2">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </label>
  );
}

function TabButton({ active, disabled, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        disabled
          ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200"
          : active
            ? "bg-slate-900 text-white"
            : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{text}</p>
    </div>
  );
}

const resolveComponentOptions = (componentOptions, variant) =>
  Array.isArray(componentOptions?.[variant]) ? componentOptions[variant] : [];

const resolveDefaultComponentKey = (componentOptions, variant, fallback = "") =>
  resolveComponentOptions(componentOptions, variant)[0]?.value || fallback || "";

export default function ETemplateBuilder() {
  const accessToken = useSelector((state) => state.auth.accessToken);
  const navigate = useNavigate();
  const location = useLocation();
  const { templateId } = useParams();
  const [template, setTemplate] = useState(null);
  const [builder, setBuilder] = useState(createDefaultBuilder());
  const [options, setOptions] = useState({
    categories: [],
    template_variants: [],
    section_presets: {},
    section_presets_by_category: {},
    category_preset_map: {},
    component_options: {},
    page_components_by_category: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionMediaUploading, setSectionMediaUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("pages");
  const [selectedPageId, setSelectedPageId] = useState(null);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [selectedActionId, setSelectedActionId] = useState(null);
  const [actionEditorOpen, setActionEditorOpen] = useState(false);
  const [activeActionPlacement, setActiveActionPlacement] = useState("header");
  const [footerGroupDraft, setFooterGroupDraft] = useState({
    group_key: "",
    title: "",
    note: "",
    target_page_ids: [],
  });
  const [footerEditorMode, setFooterEditorMode] = useState("edit");
  const [activeSectionGroup, setActiveSectionGroup] = useState("");
  const [sectionEditorOpen, setSectionEditorOpen] = useState(false);
  const [expandedSectionGroups, setExpandedSectionGroups] = useState({});
  const [draggedSectionId, setDraggedSectionId] = useState(null);
  const [draggedActionId, setDraggedActionId] = useState(null);
  const [draggedFooterGroupKey, setDraggedFooterGroupKey] = useState(null);
  const sectionCardRefs = useRef(new Map());
  const previousSectionRectsRef = useRef(new Map());
  const actionCardRefs = useRef(new Map());
  const previousActionRectsRef = useRef(new Map());
  const footerGroupCardRefs = useRef(new Map());
  const previousFooterGroupRectsRef = useRef(new Map());

  const pages = useMemo(() => builder.pages || [], [builder.pages]);
  const sections = useMemo(() => builder.sections || [], [builder.sections]);
  const actions = useMemo(() => builder.actions || [], [builder.actions]);
  const hasPages = pages.length > 0;
  const defaultPageId = builder.default_page_id || pages[0]?.id || null;
  const defaultPage = pages.find((page) => page.id === defaultPageId) || pages[0] || null;
  const templateVariants = useMemo(
    () => builder.meta?.template_variants || options.template_variants || [],
    [builder.meta?.template_variants, options.template_variants]
  );
  const sectionPresets = useMemo(
    () => builder.meta?.section_presets || options.section_presets || {},
    [builder.meta?.section_presets, options.section_presets]
  );
  const categoryPresetMap = useMemo(
    () => builder.meta?.category_preset_map || options.category_preset_map || {},
    [builder.meta?.category_preset_map, options.category_preset_map]
  );
  const sectionPresetsByCategory = useMemo(
    () => builder.meta?.section_presets_by_category || options.section_presets_by_category || {},
    [builder.meta?.section_presets_by_category, options.section_presets_by_category]
  );
  const componentOptions = useMemo(
    () => builder.meta?.component_options || options.component_options || {},
    [builder.meta?.component_options, options.component_options]
  );
  const pageComponentsByCategory = useMemo(
    () => builder.meta?.page_components_by_category || options.page_components_by_category || {},
    [builder.meta?.page_components_by_category, options.page_components_by_category]
  );
  const templateCategoryName = useMemo(() => {
    const firstCategory = Array.isArray(template?.categories) ? template.categories[0] : null;
    return String(typeof firstCategory === "string" ? firstCategory : firstCategory?.name || "").trim();
  }, [template?.categories]);
  const templateCategoryKey = useMemo(() => {
    const firstCategory = Array.isArray(template?.categories) ? template.categories[0] : null;
    const explicitKey = typeof firstCategory === "object" && firstCategory ? firstCategory.key : "";
    return String(explicitKey || slugifyValue(templateCategoryName)).trim();
  }, [template?.categories, templateCategoryName]);

  useEffect(() => {
    if (!hasPages && activeTab !== "pages") {
      setActiveTab("pages");
    }
  }, [hasPages, activeTab]);

  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0] || null;
  const isDefaultPageSelected = Boolean(selectedPage && defaultPageId && selectedPage.id === defaultPageId);
  const selectedPageThemeKey = routeKeyToThemePageKey(selectedPage?.route_key, selectedPage?.slug);
  const selectedPageComponentOptions = Array.isArray(pageComponentsByCategory?.[templateCategoryKey]?.[selectedPageThemeKey])
    ? pageComponentsByCategory[templateCategoryKey][selectedPageThemeKey]
    : [];
  const currentVisitPath = useMemo(() => {
    const pageName = selectedPage?.name || "No page";
    const tabName =
      activeTab === "sections"
        ? "sections"
        : activeTab === "actions"
          ? "links"
          : "pages";

    return `${pageName.toLowerCase()} / ${tabName}`;
  }, [activeTab, selectedPage?.name]);
  const sectionsForSelectedPage = useMemo(
    () =>
      sections
        .filter((section) => section.page_id === selectedPage?.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [sections, selectedPage]
  );
  const selectedSection =
    sectionsForSelectedPage.find((section) => section.id === selectedSectionId) ||
    sections.find((section) => section.id === selectedSectionId) ||
    null;
  const actionsForSelectedPage = useMemo(
    () =>
      sortActionsForBuilder(actions.filter((action) => action.page_id === selectedPage?.id)),
    [actions, selectedPage]
  );
  const actionGroupsForSelectedPage = useMemo(
    () =>
      ACTION_PLACEMENT_ORDER.reduce((acc, placement) => {
        acc[placement] = actionsForSelectedPage.filter(
          (action) => normalizeActionPlacement(action.placement) === placement
        );
        return acc;
      }, {}),
    [actionsForSelectedPage]
  );
  const footerGroupSuggestions = useMemo(
    () =>
      Array.from(
        new Set(
          actionsForSelectedPage
            .filter((action) => normalizeActionPlacement(action.placement) === "footer")
            .map((action) => String(action.footer_group || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [actionsForSelectedPage]
  );
  const footerGroupsForSelectedPage = useMemo(() => {
    const grouped = new Map();

    actionsForSelectedPage
      .filter((action) => normalizeActionPlacement(action.placement) === "footer")
      .forEach((action) => {
        const groupKey = String(action.footer_group || "").trim() || "footer-group";
        if (!grouped.has(groupKey)) {
          grouped.set(groupKey, []);
        }
        grouped.get(groupKey).push(action);
      });

    return Array.from(grouped.entries()).map(([groupKey, groupActions]) => ({
      group_key: groupKey,
      title: String(groupActions[0]?.footer_group || "").trim() || getFooterGroupDisplayTitle(groupKey),
      note: String(groupActions.find((item) => String(item.label || "").trim())?.label || "").trim(),
      actions: sortActionsForBuilder(groupActions),
      target_page_ids: collectActionTargetPageIds(groupActions),
    })).filter((group) => group.target_page_ids.length > 0);
  }, [actionsForSelectedPage]);
  const activeActionGroupActions = useMemo(
    () => actionGroupsForSelectedPage[activeActionPlacement] || [],
    [actionGroupsForSelectedPage, activeActionPlacement]
  );
  const sectionsByVariantForSelectedPage = useMemo(
    () =>
      sectionsForSelectedPage.reduce((acc, section) => {
        const key = String(section.variant || "other");
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(section);
        return acc;
      }, {}),
    [sectionsForSelectedPage]
  );
  const selectedAction =
    actionsForSelectedPage.find((action) => action.id === selectedActionId) ||
    actions.find((action) => action.id === selectedActionId) ||
    null;
  const actionEditorAction =
    selectedAction ||
    (footerEditorMode === "new" && selectedPage
      ? {
          id: footerGroupDraft.group_key || "footer-group-draft",
          page_id: selectedPage.id,
          section_id: "",
          name: "New Footer Segment",
          slug: "new-footer-segment",
          expression: "",
          link_type: "storefront_page",
          route_key: "",
          target_page_id: "",
          target_page_slug: "",
          target_page_route_mode: "custom_url",
          target_page_route_key: "",
          label: "",
          placement: "footer",
          footer_group: footerGroupDraft.group_key || "",
          sort_order: 1,
        }
      : null);

  useEffect(() => {
    if (!ACTION_PLACEMENT_ORDER.includes(activeActionPlacement)) {
      setActiveActionPlacement("header");
    }
  }, [activeActionPlacement]);

  useEffect(() => {
    if (footerEditorMode === "new" && actionEditorOpen) {
      return;
    }

    if (actionsForSelectedPage.length === 0) {
      setSelectedActionId(null);
      setActionEditorOpen(false);
      setFooterGroupDraft({
        group_key: "",
        title: "",
        note: "",
        target_page_ids: [],
      });
      return;
    }

    if (
      selectedActionId &&
      actionsForSelectedPage.some((action) => action.id === selectedActionId)
    ) {
      const current = actionsForSelectedPage.find((action) => action.id === selectedActionId);
      if (current) {
        setActiveActionPlacement(normalizeActionPlacement(current.placement));
      }
      return;
    }

    const firstActionInGroup = activeActionGroupActions[0] || null;
    if (firstActionInGroup) {
      setSelectedActionId(firstActionInGroup.id);
      setActiveActionPlacement(normalizeActionPlacement(firstActionInGroup.placement));
    }
  }, [actionsForSelectedPage, activeActionGroupActions, selectedActionId, footerEditorMode, actionEditorOpen]);

  useEffect(() => {
    if (footerEditorMode === "new") {
      return;
    }

    if (!selectedAction || normalizeActionPlacement(selectedAction.placement) !== "footer") {
      return;
    }

    const groupKey = String(selectedAction.footer_group || "").trim() || normalizeFooterGroupKey(selectedAction.name);
    const footerGroup = footerGroupsForSelectedPage.find((group) => group.group_key === groupKey);

    setFooterGroupDraft({
      group_key: groupKey,
      title: footerGroup?.title || groupKey,
      note: footerGroup?.note || "",
      target_page_ids: footerGroup?.target_page_ids || [],
    });
  }, [footerGroupsForSelectedPage, selectedAction, footerEditorMode]);
  const visibleTemplatePresetLibrary = useMemo(() => {
    const configuredCategoryPresets = sectionPresetsByCategory?.[templateCategoryKey];
    if (configuredCategoryPresets && typeof configuredCategoryPresets === "object") {
      return configuredCategoryPresets;
    }

    if (!templateCategoryName) {
      return sectionPresets;
    }

    const categoryMap = categoryPresetMap[templateCategoryName];
    if (!categoryMap || typeof categoryMap !== "object") {
      return sectionPresets;
    }

    return Object.entries(categoryMap).reduce((acc, [variantKey, presetKeys]) => {
      const allowedKeys = new Set((Array.isArray(presetKeys) ? presetKeys : []).map((key) => String(key)));
      const presets = Array.isArray(sectionPresets?.[variantKey]) ? sectionPresets[variantKey] : [];
      const filteredPresets = presets.filter((preset) => allowedKeys.has(String(preset.preset_key)));

      if (filteredPresets.length > 0) {
        acc[variantKey] = filteredPresets;
      }

      return acc;
    }, {});
  }, [categoryPresetMap, sectionPresets, sectionPresetsByCategory, templateCategoryKey, templateCategoryName]);
  const resolveDefaultPresetForVariant = (variantKey) => {
    const presets = visibleTemplatePresetLibrary?.[variantKey] || [];
    if (presets.length === 0) {
      return null;
    }

    return presets[0];
  };
  const visibleTemplatePresetEntries = useMemo(
    () => Object.entries(visibleTemplatePresetLibrary),
    [visibleTemplatePresetLibrary]
  );
  const activePresetGroupEntry = useMemo(() => {
    if (!visibleTemplatePresetEntries.length) {
      return null;
    }

    return visibleTemplatePresetEntries.find(([groupKey]) => groupKey === activeSectionGroup) || visibleTemplatePresetEntries[0];
  }, [activeSectionGroup, visibleTemplatePresetEntries]);
  const activePresetGroupKey = activePresetGroupEntry?.[0] || "";
  const activePresetGroupPresets = activePresetGroupEntry?.[1] || [];
  const activePresetGroupLabel =
    templateVariants.find((item) => item.value === activePresetGroupKey)?.label || activePresetGroupKey;
  const availablePresets = useMemo(() => {
    const variantKey = selectedSection?.variant || templateVariants[0]?.value || "hero";
    return visibleTemplatePresetLibrary?.[variantKey] || [];
  }, [selectedSection?.variant, templateVariants, visibleTemplatePresetLibrary]);
  const customSectionsForSelectedPage = useMemo(
    () =>
      sectionsForSelectedPage.filter((section) => {
        if (section.layout !== "template") {
          return true;
        }

        return !visibleTemplatePresetLibrary[String(section.variant || "")];
      }),
    [sectionsForSelectedPage, visibleTemplatePresetLibrary]
  );
  const sectionsByVariant = useMemo(
    () =>
      sections.reduce((acc, section) => {
        const key = String(section.variant || "other");
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(section);
        return acc;
      }, {}),
    [sections]
  );
  const selectedPreset = useMemo(
    () => availablePresets.find((preset) => preset.preset_key === selectedSection?.preset_key) || null,
    [availablePresets, selectedSection?.preset_key]
  );
  const selectedSectionSchema = useMemo(() => {
    const schemas = [selectedSection?.editor_schema, selectedPreset?.config_schema].filter(Boolean);
    if (selectedSection?.variant === "custom") {
      schemas.push(customSectionSchema);
    }
    return schemas.find((schema) => Array.isArray(schema?.fields) && schema.fields.length > 0) || schemas[0] || null;
  }, [selectedPreset?.config_schema, selectedSection?.editor_schema, selectedSection?.variant]);
  const selectedSectionConfig = (() => {
    const config = mergeSectionSchemaConfig(selectedSectionSchema, selectedSection?.config);
    const legacyTitle = String(selectedSection?.title || "");
    const legacySubtitle = String(selectedSection?.subtitle || "");
    const legacyHtml = String(selectedSection?.rich_text_html || "");

    if (selectedSection?.variant === "custom") {
      return {
        ...config,
        content: {
          ...config.content,
          title: config.content.title || legacyTitle,
          subtitle: config.content.subtitle || legacySubtitle,
          html: config.content.html || legacyHtml,
        },
      };
    }

    return config;
  })();

  useEffect(() => {
    if (visibleTemplatePresetEntries.length > 0 && !activeSectionGroup) {
      setActiveSectionGroup(visibleTemplatePresetEntries[0][0]);
    }
  }, [activeSectionGroup, visibleTemplatePresetEntries]);

  useEffect(() => {
    if (!selectedSection) {
      setSectionEditorOpen(false);
    }
  }, [selectedSection]);

  useLayoutEffect(() => {
    if (!selectedPage) {
      previousSectionRectsRef.current = new Map();
      return;
    }

    const currentRects = new Map();

    sectionsForSelectedPage.forEach((section) => {
      const node = sectionCardRefs.current.get(section.id);
      if (node) {
        currentRects.set(section.id, node.getBoundingClientRect());
      }
    });

    const previousRects = previousSectionRectsRef.current;

    sectionsForSelectedPage.forEach((section) => {
      const node = sectionCardRefs.current.get(section.id);
      const previous = previousRects.get(section.id);
      const current = currentRects.get(section.id);

      if (!node || !previous || !current) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (!deltaX && !deltaY) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }
      );
    });

    previousSectionRectsRef.current = currentRects;
  }, [sectionsForSelectedPage, selectedPage]);

  useLayoutEffect(() => {
    if (!selectedPage) {
      previousActionRectsRef.current = new Map();
      return;
    }

    const currentRects = new Map();

    activeActionGroupActions.forEach((action) => {
      const node = actionCardRefs.current.get(action.id);
      if (node) {
        currentRects.set(action.id, node.getBoundingClientRect());
      }
    });

    const previousRects = previousActionRectsRef.current;

    activeActionGroupActions.forEach((action) => {
      const node = actionCardRefs.current.get(action.id);
      const previous = previousRects.get(action.id);
      const current = currentRects.get(action.id);

      if (!node || !previous || !current) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (!deltaX && !deltaY) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }
      );
    });

    previousActionRectsRef.current = currentRects;
  }, [activeActionGroupActions, selectedPage]);

  useLayoutEffect(() => {
    if (!selectedPage) {
      previousFooterGroupRectsRef.current = new Map();
      return;
    }

    const currentRects = new Map();

    footerGroupsForSelectedPage.forEach((group) => {
      const node = footerGroupCardRefs.current.get(group.group_key);
      if (node) {
        currentRects.set(group.group_key, node.getBoundingClientRect());
      }
    });

    const previousRects = previousFooterGroupRectsRef.current;

    footerGroupsForSelectedPage.forEach((group) => {
      const node = footerGroupCardRefs.current.get(group.group_key);
      const previous = previousRects.get(group.group_key);
      const current = currentRects.get(group.group_key);

      if (!node || !previous || !current) {
        return;
      }

      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;

      if (!deltaX && !deltaY) {
        return;
      }

      node.animate(
        [
          { transform: `translate(${deltaX}px, ${deltaY}px)` },
          { transform: "translate(0px, 0px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }
      );
    });

    previousFooterGroupRectsRef.current = currentRects;
  }, [footerGroupsForSelectedPage, selectedPage]);

  useEffect(() => {
    setExpandedSectionGroups((prev) => {
      const nextState = visibleTemplatePresetEntries.reduce((acc, [groupKey], index) => {
        acc[groupKey] = Object.prototype.hasOwnProperty.call(prev, groupKey) ? prev[groupKey] : index === 0;
        return acc;
      }, {});

      if (customSectionsForSelectedPage.length > 0) {
        nextState.custom = Object.prototype.hasOwnProperty.call(prev, "custom") ? prev.custom : true;
      }

      return nextState;
    });
  }, [customSectionsForSelectedPage.length, visibleTemplatePresetEntries]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const [optionsResponse, response] = await Promise.all([
          getETemplateOptions(accessToken),
          getETemplateBuilder(accessToken, templateId),
        ]);
        if (!mounted) return;

        const nextTemplate = response?.data?.template || null;
        const nextBuilder = response?.data?.builder || createDefaultBuilder();
        if (!nextBuilder.default_page_id && Array.isArray(nextBuilder.pages) && nextBuilder.pages[0]?.id) {
          nextBuilder.default_page_id = nextBuilder.pages[0].id;
        }
        setOptions(optionsResponse?.data || { categories: [], template_variants: [], section_presets: {}, section_presets_by_category: {}, category_preset_map: {}, component_options: {}, page_components_by_category: {} });
        setTemplate(nextTemplate);
        setBuilder(nextBuilder);
        setSelectedPageId(nextBuilder.default_page_id || nextBuilder.pages?.[0]?.id || null);
        setSelectedSectionId(nextBuilder.sections?.[0]?.id || null);
        setSelectedActionId(nextBuilder.actions?.[0]?.id || null);
      } catch (error) {
        if (mounted) {
          toast.error(error?.response?.data?.message || error?.message || "Failed to load template builder");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (accessToken && templateId) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [accessToken, templateId]);

  const updateBuilderList = (key, updater) => {
    setBuilder((prev) => ({
      ...prev,
      [key]: updater(Array.isArray(prev[key]) ? prev[key] : []),
    }));
  };

  const updatePageField = (pageId, field, value) => {
    updateBuilderList("pages", (items) =>
      items.map((page) => {
        if (page.id !== pageId) return page;

        if (field === "name") {
          const nextName = value;
          return {
            ...page,
            name: nextName,
            slug:
              page.route_mode === "internal_route"
                ? page.slug
                : String(page.slug || "").trim() || slugifyValue(nextName),
          };
        }

        if (field === "route_mode") {
          if (value === "internal_route") {
            const fallbackRoute = PAGE_INTERNAL_ROUTE_SET.has(String(page.route_key || "").trim())
              ? String(page.route_key || "").trim()
              : STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value;

            return {
              ...page,
              route_mode: "internal_route",
              route_key: fallbackRoute,
              slug: routeKeyToPageSlug(fallbackRoute),
            };
          }

          return {
            ...page,
            route_mode: "custom_url",
            route_key: "",
            slug: String(page.slug || "").trim() || slugifyValue(page.name || ""),
          };
        }

        if (field === "route_key") {
          const normalizedRoute = PAGE_INTERNAL_ROUTE_SET.has(String(value || "").trim())
            ? String(value || "").trim()
            : STOREFRONT_INTERNAL_ROUTE_OPTIONS[0].value;

          return {
            ...page,
            route_mode: "internal_route",
            route_key: normalizedRoute,
            slug: routeKeyToPageSlug(normalizedRoute),
          };
        }

        if (field === "slug") {
          return {
            ...page,
            slug: slugifyValue(value),
          };
        }

        return { ...page, [field]: value };
      })
    );
  };

  const updateSectionField = (sectionId, field, value) => {
    updateBuilderList("sections", (items) =>
      items.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        if (field === "variant") {
          const nextPresets = visibleTemplatePresetLibrary?.[value] || [];
          const selectedPreset = nextPresets.find((preset) => preset.preset_key === section.preset_key) || resolveDefaultPresetForVariant(value);
          const nextPresetKey = selectedPreset?.preset_key || "";
          const nextComponentKey = selectedPreset?.component_key
            || resolveDefaultComponentKey(componentOptions, value, section.component_key);

          setActiveSectionGroup(String(value));

          return {
            ...section,
            variant: value,
            preset_key: nextPresetKey,
            component_key: nextComponentKey,
            editor_schema: selectedPreset?.config_schema || (value === "custom" ? customSectionSchema : null),
            config: mergeSectionSchemaConfig(selectedPreset?.config_schema || (value === "custom" ? customSectionSchema : null), section.config),
          };
        }

        if (field === "preset_key") {
          const nextPreset = (visibleTemplatePresetLibrary?.[section.variant] || []).find((preset) => preset.preset_key === value) || null;

          return {
            ...section,
            preset_key: value,
            component_key: nextPreset?.component_key || section.component_key,
            editor_schema: nextPreset?.config_schema || section.editor_schema || (section.variant === "custom" ? customSectionSchema : null),
            config: mergeSectionSchemaConfig(nextPreset?.config_schema || section.editor_schema || (section.variant === "custom" ? customSectionSchema : null), section.config),
          };
        }

        return { ...section, [field]: value };
      })
    );
  };

  const updateSectionConfig = (sectionId, config) => {
    updateBuilderList("sections", (items) => items.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }

      return {
        ...section,
        config,
        ...(section.variant === "custom"
          ? {
              title: String(config?.content?.title || ""),
              subtitle: String(config?.content?.subtitle || ""),
              rich_text_html: String(config?.content?.html || ""),
            }
          : {}),
      };
    }));
  };

  const uploadSectionConfigMedia = async (section, field, fileList, repeaterContext = null) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setSectionMediaUploading(true);
    try {
      const response = await uploadStorefrontSectionMedia(accessToken, files);
      const urls = (response.data || []).map((item) => item.url).filter(Boolean);
      const group = field.group || "content";
      const config = mergeSectionSchemaConfig(selectedSectionSchema, section.config);
      const current = config[group]?.[field.key];
      let nextValue;
      if (repeaterContext?.field?.key && Number.isInteger(repeaterContext.index)) {
        const items = Array.isArray(current) ? [...current] : [];
        const childField = repeaterContext.field;
        const item = { ...(items[repeaterContext.index] || {}) };
        const childCurrent = item[childField.key];
        item[childField.key] = ["slider", "multiple_image"].includes(String(childField.type || childField.input_type))
          ? [...(Array.isArray(childCurrent) ? childCurrent : []), ...urls]
          : (urls[0] ? { url: urls[0], alt: "" } : childCurrent);
        items[repeaterContext.index] = item;
        nextValue = items;
      } else {
        nextValue = ["slider", "multiple_image"].includes(String(field.type))
          ? [...(Array.isArray(current) ? current : []), ...urls]
          : (urls[0] ? { url: urls[0], alt: "" } : current);
      }
      updateSectionConfig(section.id, { ...config, [group]: { ...config[group], [field.key]: nextValue } });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Failed to upload image");
    } finally {
      setSectionMediaUploading(false);
    }
  };

  const toggleSectionCategory = (sectionId, category) => {
    updateBuilderList("sections", (items) =>
      items.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        const current = Array.isArray(section.category_refs) ? section.category_refs : [];
        const exists = current.some((item) => String(item.id) === String(category.id));

        return {
          ...section,
          category_refs: exists
            ? current.filter((item) => String(item.id) !== String(category.id))
            : [...current, { id: category.id, name: category.name }],
        };
      })
    );
  };

  const applySectionPreset = (sectionId, preset) => {
    updateBuilderList("sections", (items) =>
      items.map((section) => {
        if (section.id !== sectionId) {
          return section;
        }

        const nextCategoryRefs =
          Array.isArray(section.category_refs) && section.category_refs.length > 0
            ? section.category_refs
            : Array.isArray(preset.categories) && preset.categories.length > 0
              ? preset.categories
              : [];

        return {
          ...section,
          preset_key: preset.preset_key,
          component_key: preset.component_key || section.component_key,
          category_refs: nextCategoryRefs,
        };
      })
    );
  };

  const updateActionField = (actionId, field, value) => {
    updateBuilderList("actions", (items) =>
      items.map((action) => {
        if (action.id !== actionId) return action;

        if (field === "name") {
          return {
            ...action,
            name: value,
            slug: String(action.slug || "").trim() || slugifyValue(value),
          };
        }

        if (field === "link_type") {
          return {
            ...action,
            ...buildStorefrontActionLinkState({
              ...action,
              link_type: value,
            }),
          };
        }

        if (field === "route_key") {
          return {
            ...action,
            route_key: value,
            expression: value,
          };
        }

        if (field === "slug") {
          return {
            ...action,
            slug: slugifyValue(value),
          };
        }

        if (field === "placement") {
          const nextPlacement = normalizeActionPlacement(value);
          const siblingCount = items.filter(
            (item) =>
              item.id !== actionId &&
              item.page_id === action.page_id &&
              normalizeActionPlacement(item.placement) === nextPlacement
          ).length;

          return {
            ...action,
            placement: nextPlacement,
            footer_group: nextPlacement === "footer" ? action.footer_group || "" : "",
            section_id: "",
            sort_order: siblingCount + 1,
          };
        }

        if (field === "target_page_id") {
          const targetPage = pages.find((page) => page.id === value) || null;

          return {
            ...action,
            target_page_id: value,
            target_page_slug: targetPage?.slug || "",
            target_page_route_mode: targetPage?.route_mode || "custom_url",
            target_page_route_key: targetPage?.route_key || "",
            expression: "",
            route_key: "",
          };
        }

        if (field === "page_id") {
          const nextSections = sections.filter((section) => section.page_id === value);
          const nextSectionId = nextSections.some((section) => section.id === action.section_id)
            ? action.section_id
            : "";
          const nextPlacementCount = items.filter(
            (item) => item.id !== actionId && item.page_id === value && normalizeActionPlacement(item.placement) === normalizeActionPlacement(action.placement)
          ).length;

          return {
            ...action,
            page_id: value,
            section_id: nextSectionId,
            sort_order: nextPlacementCount + 1,
          };
        }

        return { ...action, [field]: value };
      })
    );
  };

  const addPage = () => {
    const nextPage = createBlankPage();
    setBuilder((prev) => ({
      ...prev,
      pages: [...(prev.pages || []), nextPage],
      default_page_id: prev.default_page_id || nextPage.id,
    }));
    setSelectedPageId(nextPage.id);
    setSelectedSectionId(null);
    setSelectedActionId(null);
  };

  const removePage = (pageId) => {
    if (pageId === defaultPageId) {
      toast.error("The default Home page cannot be deleted");
      return;
    }

    const nextBuilder = {
      ...builder,
      pages: (builder.pages || []).filter((page) => page.id !== pageId),
      sections: (builder.sections || []).filter((section) => section.page_id !== pageId),
      actions: (builder.actions || []).filter((action) => action.page_id !== pageId && action.target_page_id !== pageId),
    };

    setBuilder(nextBuilder);

    const remainingPages = nextBuilder.pages || [];
    setSelectedPageId(remainingPages[0]?.id || null);
    setSelectedSectionId(null);
    setSelectedActionId(null);

    persistBuilder(nextBuilder, "Page deleted successfully");
  };

  const addSection = () => {
    if (!selectedPage) {
      toast.info("Create a page first");
      return;
    }

    const nextVariant = activeSectionGroup || visibleTemplatePresetEntries[0]?.[0] || templateVariants[0]?.value || "hero";
    const nextPreset = resolveDefaultPresetForVariant(nextVariant) || (visibleTemplatePresetLibrary?.[nextVariant] || [])[0] || null;
    const nextSection = {
      ...createBlankSection(selectedPage.id, sectionsForSelectedPage.length),
      variant: nextVariant,
      preset_key: nextPreset?.preset_key || "",
      component_key: nextPreset?.component_key || resolveDefaultComponentKey(componentOptions, nextVariant, "storefront-hero"),
      title: nextPreset?.name || nextVariant.replace(/_/g, " "),
      name: slugifyValue(nextPreset?.name || nextVariant || `section_${sectionsForSelectedPage.length + 1}`),
      editor_schema: nextPreset?.config_schema || null,
      config: sectionSchemaDefaults(nextPreset?.config_schema),
    };

    updateBuilderList("sections", (items) => [...items, nextSection]);
    setSelectedSectionId(nextSection.id);
    setActiveSectionGroup(nextVariant);
  };

  const addSectionFromPreset = (variantKey, preset) => {
    if (!selectedPage) {
      toast.info("Create a page first");
      return;
    }

    const nextSection = {
      ...createBlankSection(selectedPage.id, sectionsForSelectedPage.length),
      variant: variantKey,
      preset_key: preset?.preset_key || "",
      component_key: preset?.component_key || resolveDefaultComponentKey(componentOptions, variantKey, "storefront-hero"),
      title: preset?.name || preset?.label || "New Section",
      name: slugifyValue(preset?.name || preset?.label || `${variantKey}-section`),
      category_refs: Array.isArray(preset?.categories) ? preset.categories : [],
      editor_schema: preset?.config_schema || null,
      config: sectionSchemaDefaults(preset?.config_schema),
    };

    updateBuilderList("sections", (items) => [...items, nextSection]);
    setSelectedSectionId(nextSection.id);
    setActiveSectionGroup(variantKey);
  };

  const removeSection = (sectionId) => {
    updateBuilderList("sections", (items) => items.filter((section) => section.id !== sectionId));
    updateBuilderList("actions", (items) =>
      items.map((action) =>
        action.section_id === sectionId ? { ...action, section_id: "" } : action
      )
    );
    const remainingSections = sectionsForSelectedPage.filter((section) => section.id !== sectionId);
    setSelectedSectionId((currentId) => (currentId === sectionId ? remainingSections[0]?.id || null : currentId));
  };

  const moveSection = (sectionId, direction) => {
    const pageSections = sectionsForSelectedPage;
    const currentIndex = pageSections.findIndex((section) => section.id === sectionId);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= pageSections.length) return;

    const reordered = [...pageSections];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    updateBuilderList("sections", (items) => {
      const otherSections = items.filter((section) => section.page_id !== selectedPage.id);
      const normalized = reordered.map((section, index) => ({
        ...section,
        order: index + 1,
      }));
      return [...otherSections, ...normalized];
    });
  };

  const reorderSections = (dragSectionId, dropSectionId) => {
    if (!selectedPage || !dragSectionId || !dropSectionId || dragSectionId === dropSectionId) {
      return;
    }

    const pageSections = [...sectionsForSelectedPage];
    const dragIndex = pageSections.findIndex((section) => section.id === dragSectionId);
    const dropIndex = pageSections.findIndex((section) => section.id === dropSectionId);

    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }

    const reordered = [...pageSections];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, moved);

    updateBuilderList("sections", (items) => {
      const otherSections = items.filter((section) => section.page_id !== selectedPage.id);
      const normalized = reordered.map((section, index) => ({
        ...section,
        order: index + 1,
      }));

      return [...otherSections, ...normalized];
    });
  };

  const addAction = (placement = "header") => {
    const nextPlacement = normalizeActionPlacement(placement);

    if (!selectedPage) {
      toast.info("Create a page first");
      return;
    }

    if (!isDefaultPageSelected) {
      toast.info("Select the default page to manage links");
      return;
    }

    const nextSortOrder =
      actionsForSelectedPage.filter(
        (action) => normalizeActionPlacement(action.placement) === nextPlacement
      ).length + 1;

    if (nextPlacement === "footer") {
      const draftKey = createId("footer-group");
      setFooterGroupDraft({
        group_key: draftKey,
        title: "",
        note: "",
        target_page_ids: [],
      });
      setFooterEditorMode("new");
      setSelectedActionId(null);
      setActiveActionPlacement(nextPlacement);
      setActionEditorOpen(true);
      return;
    }

    const nextAction = createBlankAction(
      selectedPage.id,
      "",
      nextPlacement,
      nextSortOrder
    );

    setFooterEditorMode("edit");
    updateBuilderList("actions", (items) => [...items, nextAction]);
    setSelectedActionId(nextAction.id);
    setActiveActionPlacement(nextPlacement);
    setActionEditorOpen(true);
  };

  const removeAction = (actionId) => {
    const removedAction = actions.find((action) => action.id === actionId) || null;

    updateBuilderList("actions", (items) => {
      const remaining = items.filter((action) => action.id !== actionId);

      if (!removedAction) {
        return remaining;
      }

      const remainingPageItems = remaining.filter((action) => action.page_id === removedAction.page_id);
      const placement = normalizeActionPlacement(removedAction.placement);
      const reorderedPlacementItems = sortActionsForBuilder(
        remainingPageItems.filter((action) => normalizeActionPlacement(action.placement) === placement)
      ).map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));
      const reorderedPlacementMap = new Map(reorderedPlacementItems.map((action) => [action.id, action]));

      return remaining.map((action) => {
        if (action.page_id !== removedAction.page_id) {
          return action;
        }

        const updated = reorderedPlacementMap.get(action.id);
        return updated || action;
      });
    });

    const remainingInPage = sortActionsForBuilder(
      actions.filter((action) => action.id !== actionId && action.page_id === selectedPage?.id)
    );
    setSelectedActionId(remainingInPage[0]?.id || null);
    if (selectedActionId === actionId) {
      setActionEditorOpen(false);
    }
  };

  const closeActionEditor = () => {
    setActionEditorOpen(false);
    setFooterEditorMode("edit");
  };

  const syncFooterGroupActions = ({ previousGroupKey, nextGroupTitle, nextGroupNote, nextPageIds }) => {
    if (!selectedPage) {
      return;
    }

    const normalizedPreviousKey = normalizeFooterGroupKey(previousGroupKey || nextGroupTitle);
    const nextTitle = String(nextGroupTitle || "").trim() || getFooterGroupDisplayTitle(normalizedPreviousKey);
    const nextNote = String(nextGroupNote || "").trim();
    const normalizedPageIds = Array.from(
      new Set((Array.isArray(nextPageIds) ? nextPageIds : []).map((pageId) => String(pageId).trim()).filter(Boolean))
    );

    if (normalizedPageIds.length === 0) {
      toast.info("Select at least one page for this footer segment.");
      return;
    }

    const pageLookup = new Map(pages.map((page) => [String(page.id), page]));

    updateBuilderList("actions", (items) => {
      const pageFooterActions = sortActionsForBuilder(
        items.filter(
          (action) =>
            action.page_id === selectedPage.id &&
            normalizeActionPlacement(action.placement) === "footer"
        )
      );
      const nextItems = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer"
      );

      const groupedFooterActions = [];
      const groupedFooterActionsByKey = new Map();

      pageFooterActions.forEach((action) => {
        const actionGroupKey = normalizeFooterGroupKey(action.footer_group);
        const isDraftPlaceholder =
          action.id === selectedAction?.id &&
          !String(action.target_page_id || "").trim() &&
          !String(action.footer_group || "").trim() &&
          String(action.name || "").trim() === "New Footer Segment";

        if (isDraftPlaceholder) {
          return;
        }

        if (!groupedFooterActionsByKey.has(actionGroupKey)) {
          groupedFooterActionsByKey.set(actionGroupKey, []);
          groupedFooterActions.push([actionGroupKey, groupedFooterActionsByKey.get(actionGroupKey)]);
        }

        groupedFooterActionsByKey.get(actionGroupKey).push(action);
      });

      const updatedGroupActions = [];
      const previousGroupActions = groupedFooterActionsByKey.get(normalizedPreviousKey) || [];
      const previousByTargetPageId = new Map(
        previousGroupActions.map((action) => [String(action.target_page_id || "").trim(), action])
      );

      normalizedPageIds.forEach((pageId, index) => {
        const existing = previousByTargetPageId.get(pageId) || null;
        const targetPage = pageLookup.get(pageId);

        if (!targetPage) {
          return;
        }

        updatedGroupActions.push({
          ...(existing || createBlankAction(selectedPage.id, "", "footer", index + 1)),
          page_id: selectedPage.id,
          section_id: "",
          placement: "footer",
          footer_group: nextTitle,
          label: nextNote,
          link_type: "storefront_page",
          name: targetPage.name || existing?.name || "Footer Link",
          slug: slugifyValue(targetPage.slug || existing?.slug || targetPage.name || "footer-link"),
          target_page_id: targetPage.id,
          target_page_slug: targetPage.slug || "",
          target_page_route_mode: targetPage.route_mode || "custom_url",
          target_page_route_key: targetPage.route_key || "",
          expression: "",
          route_key: "",
          sort_order: index + 1,
        });
      });

      let matchedPreviousGroup = false;
      const orderedFooterGroups = groupedFooterActions.map(([groupKey, groupActions]) => {
        if (groupKey !== normalizedPreviousKey) {
          return {
            group_key: groupKey,
            actions: sortActionsForBuilder(groupActions),
          };
        }

        matchedPreviousGroup = true;
        return {
          group_key: normalizeFooterGroupKey(nextTitle),
          actions: updatedGroupActions,
        };
      });

      if (!matchedPreviousGroup) {
        orderedFooterGroups.push({
          group_key: normalizeFooterGroupKey(nextTitle),
          actions: updatedGroupActions,
        });
      }

      const flattenedFooterActions = orderedFooterGroups
        .flatMap((group) => group.actions)
        .map((action, index) => ({
          ...action,
          sort_order: index + 1,
        }));

      return [...nextItems, ...flattenedFooterActions];
    });

    const nextFooterKey = normalizeFooterGroupKey(nextTitle);
    setFooterGroupDraft({
      group_key: nextFooterKey,
      title: nextTitle,
      note: nextNote,
      target_page_ids: normalizedPageIds,
    });
  };

  const removeFooterGroup = (groupKey) => {
    if (!selectedPage) {
      return;
    }

    const normalizedGroupKey = normalizeFooterGroupKey(groupKey);
    updateBuilderList("actions", (items) => {
      const nextItems = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer"
      );
      const pageFooterActions = sortActionsForBuilder(
        items.filter(
          (action) =>
            action.page_id === selectedPage.id &&
            normalizeActionPlacement(action.placement) === "footer" &&
            normalizeFooterGroupKey(action.footer_group) !== normalizedGroupKey &&
            !(
              !String(action.target_page_id || "").trim() &&
              !String(action.footer_group || "").trim() &&
              String(action.name || "").trim() === "New Footer Segment"
            )
        )
      ).map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));

      return [...nextItems, ...pageFooterActions];
    });

    const remainingFooterActions = sortActionsForBuilder(
      actionsForSelectedPage.filter(
        (action) =>
          normalizeActionPlacement(action.placement) === "footer" &&
          normalizeFooterGroupKey(action.footer_group) !== normalizedGroupKey
      )
    );
    const nextSelected = remainingFooterActions[0] || null;

    setFooterGroupDraft({
      group_key: "",
      title: "",
      note: "",
      target_page_ids: [],
    });

    if (!nextSelected) {
      setSelectedActionId(null);
      setActiveActionPlacement("footer");
      setActionEditorOpen(false);
      return;
    }

    setSelectedActionId(nextSelected.id);
    setActiveActionPlacement("footer");
  };

  const reorderFooterGroup = (dragGroupKey, dropGroupKey) => {
    if (!selectedPage) {
      return;
    }

    const normalizedDragKey = normalizeFooterGroupKey(dragGroupKey);
    const normalizedDropKey = normalizeFooterGroupKey(dropGroupKey);

    if (!normalizedDragKey || !normalizedDropKey || normalizedDragKey === normalizedDropKey) {
      return;
    }

    const footerGroups = footerGroupsForSelectedPage.map((group) => group.group_key);
    const dragIndex = footerGroups.indexOf(normalizedDragKey);
    const dropIndex = footerGroups.indexOf(normalizedDropKey);

    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }

    const reorderedGroups = [...footerGroups];
    const [movedGroup] = reorderedGroups.splice(dragIndex, 1);
    reorderedGroups.splice(dropIndex, 0, movedGroup);

    updateBuilderList("actions", (items) => {
      const pageFooterActions = items.filter(
        (action) =>
          action.page_id === selectedPage.id &&
          normalizeActionPlacement(action.placement) === "footer"
      );
      const otherActions = items.filter(
        (action) =>
          action.page_id !== selectedPage.id ||
          normalizeActionPlacement(action.placement) !== "footer"
      );

      const groupedActions = reorderedGroups.flatMap((groupKey) =>
        sortActionsForBuilder(
          pageFooterActions.filter((action) => normalizeFooterGroupKey(action.footer_group) === groupKey)
        )
      );

      const nextOrderedFooterActions = groupedActions.map((action, index) => ({
        ...action,
        sort_order: index + 1,
      }));

      return [...otherActions, ...nextOrderedFooterActions];
    });
  };

  const moveAction = (actionId, direction) => {
    const currentAction = actionsForSelectedPage.find((action) => action.id === actionId);
    if (!currentAction || !selectedPage) {
      return;
    }

    const currentPlacement = normalizeActionPlacement(currentAction.placement);
    const placementActions = actionsForSelectedPage.filter(
      (action) => normalizeActionPlacement(action.placement) === currentPlacement
    );
    const currentIndex = placementActions.findIndex((action) => action.id === actionId);
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= placementActions.length) {
      return;
    }

    const reordered = [...placementActions];
    const [movedAction] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedAction);

    updateBuilderList("actions", (items) => {
      const nextOrderMap = new Map(
        reordered.map((action, index) => [action.id, index + 1])
      );

      return items.map((action) => {
        if (action.page_id !== selectedPage.id) {
          return action;
        }

        if (normalizeActionPlacement(action.placement) !== currentPlacement) {
          return action;
        }

        return {
          ...action,
          sort_order: nextOrderMap.get(action.id) || action.sort_order,
        };
      });
    });
  };

  const reorderActionGroup = (dragActionId, dropActionId) => {
    const currentAction = actionsForSelectedPage.find((action) => action.id === dragActionId);
    const dropAction = actionsForSelectedPage.find((action) => action.id === dropActionId);

    if (!currentAction || !dropAction || currentAction.id === dropAction.id || !selectedPage) {
      return;
    }

    const currentPlacement = normalizeActionPlacement(currentAction.placement);
    const dropPlacement = normalizeActionPlacement(dropAction.placement);

    if (currentPlacement !== dropPlacement) {
      return;
    }

    const placementActions = actionsForSelectedPage.filter(
      (action) => normalizeActionPlacement(action.placement) === currentPlacement
    );
    const dragIndex = placementActions.findIndex((action) => action.id === dragActionId);
    const dropIndex = placementActions.findIndex((action) => action.id === dropActionId);

    if (dragIndex < 0 || dropIndex < 0) {
      return;
    }

    const reordered = [...placementActions];
    const [movedAction] = reordered.splice(dragIndex, 1);
    reordered.splice(dropIndex, 0, movedAction);

    updateBuilderList("actions", (items) => {
      const nextOrderMap = new Map(
        reordered.map((action, index) => [action.id, index + 1])
      );

      return items.map((action) => {
        if (action.page_id !== selectedPage.id) {
          return action;
        }

        if (normalizeActionPlacement(action.placement) !== currentPlacement) {
          return action;
        }

        return {
          ...action,
          sort_order: nextOrderMap.get(action.id) || action.sort_order,
        };
      });
    });
  };

  const persistBuilder = async (nextBuilder = builder, successMessage = "Template builder saved successfully") => {
    setSaving(true);
    try {
      const response = await updateETemplateBuilder(
        accessToken,
        templateId,
        createBuilderSavePayload(nextBuilder)
      );
      const nextBuilderFromServer = response?.data?.builder || createDefaultBuilder();
      const nextTemplate = response?.data?.template || template;
      setBuilder(nextBuilderFromServer);
      setTemplate(nextTemplate);
      toast.success(successMessage);
    } catch (error) {
      const errors = error?.response?.data?.errors;
      const responseMessage = error?.response?.data?.message;
      toast.error(
        Array.isArray(errors)
          ? errors.join(" | ")
          : typeof responseMessage === "string" && responseMessage.length <= 500
            ? responseMessage
            : error?.message || "Failed to save template builder"
      );
    } finally {
      setSaving(false);
    }
  };

  const saveBuilder = async () => {
    await persistBuilder(builder);
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  const toggleSectionGroupExpansion = (groupKey) => {
    setExpandedSectionGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
              onClick={() => navigate("/backoffice/e-templates")}
            >
              <PiArrowLeft className="size-4" />
              Back to Templates
            </button>
            <h1 className="text-2xl font-bold text-slate-950">
              {template?.template_name || "Template Builder"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Create the default storefront pages, links, and sections customers will get in preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{pages.length}</span> pages,{" "}
              <span className="font-semibold text-slate-900">{sections.length}</span> sections,{" "}
              <span className="font-semibold text-slate-900">{actions.length}</span> links
            </div>
            <button
              type="button"
              className="btn border-0 bg-slate-900 text-white hover:bg-slate-800"
              onClick={saveBuilder}
              disabled={saving}
            >
              <PiFloppyDisk className="size-4" />
              {saving ? "Saving..." : "Save Builder"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <TabButton active={activeTab === "pages"} icon={PiList} label="Pages" onClick={() => setActiveTab("pages")} />
        <TabButton
          active={activeTab === "sections"}
          disabled={!hasPages}
          icon={PiRows}
          label="Sections"
          onClick={() => hasPages && setActiveTab("sections")}
        />
        <TabButton
          active={activeTab === "actions"}
          disabled={!hasPages || !isDefaultPageSelected}
          icon={PiLink}
          label="Links"
          onClick={() => hasPages && isDefaultPageSelected && setActiveTab("actions")}
        />
      </div>

      {activeTab === "pages" && (
        <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Pages</h2>
                <p className="text-sm text-slate-500">Create the storefront pages this template ships with by default.</p>
              </div>
              <button type="button" className="btn btn-sm border-0 bg-slate-900 text-white hover:bg-slate-800" onClick={addPage}>
                <PiPlus className="size-4" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {pages.length === 0 ? (
                <EmptyState title="No page yet" text="Add the first predefined storefront page." />
              ) : (
                pages.map((page) => (
                  <div
                    key={page.id}
                    className={`w-full rounded-2xl px-4 py-3 transition ${
                      selectedPage?.id === page.id
                        ? "bg-slate-900 text-white"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedPageId(page.id);
                          setActiveTab("sections");
                        }}
                      >
                        <p className="text-sm font-semibold">{page.name || "Untitled Page"}</p>
                        <p className={`mt-1 text-xs ${selectedPage?.id === page.id ? "text-slate-300" : "text-slate-500"}`}>
                          {page.route_mode === "internal_route" ? page.route_key || "/" : `/${page.slug || ""}`}
                        </p>
                      </button>

                      <div className="flex items-center gap-2">
                        {defaultPageId === page.id ? (
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                              selectedPage?.id === page.id
                                ? "border-white/15 bg-white/10 text-white"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            <PiCheck className="mr-1.5 size-3.5" />
                            Default
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            selectedPage?.id === page.id
                              ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedPageId(page.id);
                            setActiveTab("pages");
                          }}
                          title="Edit page"
                        >
                          <PiNotePencil className="size-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            {!selectedPage ? (
              <EmptyState title="No page selected" text="Pick a page or create one first." />
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">{selectedPage.name || "Page"}</h3>
                    <p className="mt-1 text-sm text-slate-500">This record will later become a customer storefront page.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isDefaultPageSelected ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                        <PiCheck className="size-3.5" />
                        Default page
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-ghost text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => removePage(selectedPage.id)}
                      disabled={isDefaultPageSelected}
                      title={isDefaultPageSelected ? "The default Home page cannot be deleted" : "Delete page"}
                    >
                      <PiTrash className="size-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Page Name">
                    <input className={inputClassName} value={selectedPage.name || ""} disabled={isDefaultPageSelected} onChange={(e) => updatePageField(selectedPage.id, "name", e.target.value)} />
                  </Field>
                  <Field label="Route Mode">
                    <select className={inputClassName} value={selectedPage.route_mode || "custom_url"} disabled={isDefaultPageSelected} onChange={(e) => updatePageField(selectedPage.id, "route_mode", e.target.value)}>
                      {PAGE_ROUTE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>

                  {selectedPage.route_mode === "internal_route" ? (
                    <Field label="Internal Route">
                      <select className={inputClassName} value={selectedPage.route_key || "/"} disabled={isDefaultPageSelected} onChange={(e) => updatePageField(selectedPage.id, "route_key", e.target.value)}>
                        {STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                  ) : (
                    <Field label="Slug">
                      <input className={inputClassName} value={selectedPage.slug || ""} onChange={(e) => updatePageField(selectedPage.id, "slug", e.target.value)} />
                    </Field>
                  )}

                  {selectedPageComponentOptions.length > 0 ? (
                    <Field label="Page Design">
                      <select
                        className={inputClassName}
                        value={selectedPage.component_key || selectedPageComponentOptions[0]?.value || ""}
                        onChange={(e) => updatePageField(selectedPage.id, "component_key", e.target.value)}
                      >
                        {selectedPageComponentOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </Field>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === "sections" && (
        <section className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(620px,1.42fr)_minmax(280px,0.58fr)]">
            <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
              <div className="border-b border-slate-100 px-5 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                        Preset Library
                      </span>
                      {templateCategoryName ? (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                          {templateCategoryName}
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-950">Choose a preset, then move on.</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                      {templateCategoryName
                        ? `Only presets mapped to ${templateCategoryName} are visible here, so the builder stays quick to scan.`
                        : "Only presets mapped to the selected template category are visible here, so the builder stays quick to scan."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPage) {
                        toast.info("Create a page first");
                        return;
                      }

                      const nextSection = {
                        ...createBlankSection(selectedPage.id, sectionsForSelectedPage.length),
                        layout: "rich_text",
                        variant: "custom",
                        preset_key: "",
                        component_key: "",
                        title: "Custom Section",
                        name: `custom_section_${sectionsForSelectedPage.length + 1}`,
                        editor_schema: customSectionSchema,
                        config: sectionSchemaDefaults(customSectionSchema),
                      };

                      updateBuilderList("sections", (items) => [...items, nextSection]);
                      setSelectedSectionId(nextSection.id);
                    }}
                    className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <PiPlus className="size-4" />
                    Add Custom
                  </button>
                </div>
              </div>

              <div className="px-5 py-5">
                <div className="flex flex-wrap gap-2">
                  {visibleTemplatePresetEntries.map(([groupKey, presets]) => {
                    const groupLabel = templateVariants.find((item) => item.value === groupKey)?.label || groupKey;
                    const isActive = activePresetGroupKey === groupKey;

                    return (
                      <button
                        key={groupKey}
                        type="button"
                        onClick={() => setActiveSectionGroup(groupKey)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition ${
                          isActive
                            ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <span>{groupLabel}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"}`}>
                          {Array.isArray(presets) ? presets.length : 0}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{activePresetGroupLabel || "Select a group"}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {activePresetGroupPresets.length} preset{activePresetGroupPresets.length === 1 ? "" : "s"} available for this section type.
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    At a glance
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {activePresetGroupPresets.map((preset) => (
                    <button
                      key={preset.preset_key}
                      type="button"
                      onClick={() => addSectionFromPreset(activePresetGroupKey, preset)}
                      disabled={!selectedPage}
                      className="group flex min-h-[96px] items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                        {String(preset.name || preset.label || "P").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-950">{preset.name || preset.label}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                            {preset.preset_key}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">Use this variant for the current template page.</p>
                      </div>
                      <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition group-hover:border-slate-300 group-hover:bg-slate-50">
                        <PiPlus className="size-4" />
                        Add
                      </span>
                    </button>
                  ))}
                </div>

                {activePresetGroupPresets.length === 0 ? (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-950">No presets in this group</p>
                    <p className="mt-1 text-sm text-slate-500">Pick another section type above.</p>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-slate-100 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-slate-500">
                    {templateCategoryName
                      ? `Preset set is scoped to ${templateCategoryName}.`
                      : "Preset set is scoped to the selected template category."}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedPage) {
                        toast.info("Create a page first");
                        return;
                      }

                      const nextSection = {
                        ...createBlankSection(selectedPage.id, sectionsForSelectedPage.length),
                        layout: "rich_text",
                        variant: "custom",
                        preset_key: "",
                        component_key: "",
                        title: "Custom Section",
                        name: `custom_section_${sectionsForSelectedPage.length + 1}`,
                        editor_schema: customSectionSchema,
                        config: sectionSchemaDefaults(customSectionSchema),
                      };

                      updateBuilderList("sections", (items) => [...items, nextSection]);
                      setSelectedSectionId(nextSection.id);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <PiPlus className="size-3.5" />
                    Add custom section
                  </button>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.45)]">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-slate-900 via-slate-700 to-slate-400" />
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Builder Area</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">Canvas</h2>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    Add presets from the library, then reorder and refine the live page structure here.
                  </p>
                </div>
                <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 shadow-sm">
                  <span className="font-semibold text-slate-900">{selectedPage?.name || "No page"}</span>
                </div>
              </div>

              {!selectedPage ? (
                <EmptyState title="No page selected" text="Create or select a page first." />
              ) : sectionsForSelectedPage.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20">
                    <PiRows className="size-6" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-950">No section added yet</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Choose a preset from the left library to start building this page.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sectionsForSelectedPage.map((section) => (
                    <div
                      key={section.id}
                      ref={(node) => {
                        if (node) {
                          sectionCardRefs.current.set(section.id, node);
                        } else {
                          sectionCardRefs.current.delete(section.id);
                        }
                      }}
                      draggable
                      onDragStart={() => setDraggedSectionId(section.id)}
                      onDragEnd={() => setDraggedSectionId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={() => {
                        reorderSections(draggedSectionId, section.id);
                        setDraggedSectionId(null);
                      }}
                      onClick={() => setSelectedSectionId(section.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedSection?.id === section.id
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                          : draggedSectionId === section.id
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : "border-slate-200 bg-white text-slate-700 shadow-[0_10px_26px_-22px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      title="Drag to reorder"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
                            selectedSection?.id === section.id
                              ? "bg-white/10 text-white hover:bg-white/15"
                              : "bg-slate-50 text-slate-500 ring-1 ring-slate-200 hover:bg-white cursor-grab active:cursor-grabbing"
                          }`}
                          title="Drag section"
                        >
                          <PiDotsSixVertical className="size-4" />
                        </button>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-6">
                            {section.title || section.name || "Untitled Section"}
                          </p>
                          <p className={`mt-1 text-xs ${selectedSection?.id === section.id ? "text-slate-300" : "text-slate-500"}`}>
                            {section.preset_key || section.variant || "section"}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedSectionId(section.id);
                              setSectionEditorOpen(true);
                            }}
                            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition ${
                              selectedSection?.id === section.id
                                ? "bg-white/10 text-white hover:bg-white/15"
                                : "bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-white"
                            }`}
                            title="Edit section"
                          >
                            <PiNotePencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeSection(section.id);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              selectedSection?.id === section.id
                                ? "bg-white/10 text-white hover:bg-white/20"
                                : "bg-white text-rose-500 ring-1 ring-slate-200 hover:bg-rose-50"
                            }`}
                            title="Remove section"
                          >
                            <PiTrash className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {sectionEditorOpen && selectedSection ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close section editor"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
            onClick={() => setSectionEditorOpen(false)}
          />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-[900px] flex-col border-l border-slate-200 bg-white shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] xl:max-w-[980px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Edit Section</p>
                <h3 className="mt-2 truncate text-xl font-bold text-slate-950">
                  {selectedSection.title || selectedSection.name || "Section"}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  Update the selected section here. This drawer works for template and custom sections alike.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSectionEditorOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                title="Close"
              >
                <PiArrowLeft className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Page: {selectedPage?.name || "No page"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Preset: {selectedPreset?.name || selectedSection.preset_key || "Not set"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Variant: {selectedSection.variant || "template"}
                  </span>
                </div>

                <SectionConfigEditor
                  schema={selectedSectionSchema}
                  value={selectedSectionConfig}
                  onChange={(config) => updateSectionConfig(selectedSection.id, config)}
                  onFileChange={(field, files, context) => uploadSectionConfigMedia(selectedSection, field, files, context)}
                  uploading={sectionMediaUploading}
                  pages={pages}
                  contextKey={selectedSection.id}
                />

              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  onClick={() => {
                    removeSection(selectedSection.id);
                    setSectionEditorOpen(false);
                  }}
                >
                  <PiTrash className="size-4" />
                  Delete section
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                  onClick={() => setSectionEditorOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "actions" && (
        <section className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70">
            <div className="border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Menu Builder</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Choose the menu area and then add items to the canvas.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {ACTION_PLACEMENT_ORDER.map((placement) => {
                const placementActions = actionGroupsForSelectedPage[placement] || [];
                const isActive = activeActionPlacement === placement;

                return (
                  <button
                    key={placement}
                    type="button"
                  onClick={() => {
                    setActiveActionPlacement(placement);
                    const firstAction = placementActions[0] || null;
                    if (firstAction) {
                      setSelectedActionId(firstAction.id);
                      closeActionEditor();
                    } else {
                      setSelectedActionId(null);
                      closeActionEditor();
                    }
                  }}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${
                          isActive ? "border-white bg-white" : "border-slate-300 bg-white"
                        }`}
                        aria-hidden="true"
                      >
                        {isActive ? <span className="h-2.5 w-2.5 rounded-full bg-slate-950" /> : null}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{ACTION_PLACEMENT_LABELS[placement]}</p>
                        <p className={`mt-1 text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                          {placement === "header"
                            ? "Top navigation links"
                            : "Footer navigation links"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isActive ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {placementActions.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Canvas
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-950">
                  {ACTION_PLACEMENT_LABELS[activeActionPlacement]}
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  {defaultPage
                    ? `Flow: Pages / ${defaultPage.name || "Default Page"} / Links`
                    : "Flow: Pages / Default Page / Links"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {activeActionPlacement === "footer"
                    ? "Build footer columns as grouped segments. Each segment can include multiple pages."
                    : "Add menu items here, then click any item to edit it in a large drawer."}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => addAction(activeActionPlacement)}
                disabled={!selectedPage || !isDefaultPageSelected}
              >
                <PiPlus className="size-4" />
                {activeActionPlacement === "footer" ? "Add segment" : "Add menu"}
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {activeActionPlacement === "footer" ? (
                footerGroupsForSelectedPage.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                    <p className="text-sm font-semibold text-slate-950">No footer segments yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Add a segment, give it a title, then attach pages to build a footer column.
                    </p>
                  </div>
                ) : (
                  footerGroupsForSelectedPage.map((group) => {
                    const isSelected = normalizeFooterGroupKey(footerGroupDraft.group_key) === group.group_key;

                    return (
                      <button
                        key={group.group_key}
                        type="button"
                        ref={(node) => {
                          if (node) {
                            footerGroupCardRefs.current.set(group.group_key, node);
                          } else {
                            footerGroupCardRefs.current.delete(group.group_key);
                          }
                        }}
                        draggable
                        onDragStart={() => setDraggedFooterGroupKey(group.group_key)}
                        onDragEnd={() => setDraggedFooterGroupKey(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          reorderFooterGroup(draggedFooterGroupKey, group.group_key);
                          setDraggedFooterGroupKey(null);
                        }}
                        onClick={() => {
                          const firstAction = group.actions[0] || null;
                          if (firstAction) {
                            setFooterEditorMode("edit");
                            setSelectedActionId(firstAction.id);
                            setActiveActionPlacement("footer");
                            setActionEditorOpen(true);
                          }
                        }}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          isSelected
                            ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                            : draggedFooterGroupKey === group.group_key
                              ? "border-slate-300 bg-slate-100 text-slate-700"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl transition ${
                                  isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-500 ring-1 ring-slate-200"
                                }`}
                                title="Drag segment"
                              >
                                <PiDotsSixVertical className="size-4" />
                              </span>
                              <p className="truncate text-sm font-semibold leading-6">
                                {group.title || "Untitled Group"}
                              </p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {group.actions.length} links
                              </span>
                            </div>
                            {group.note ? (
                              <p className={`mt-1 text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                                {group.note}
                              </p>
                            ) : null}
                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.actions.map((action) => (
                                <span
                                  key={action.id}
                                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                                    isSelected
                                      ? "border-white/10 bg-white/10 text-white"
                                      : "border-slate-200 bg-slate-50 text-slate-600"
                                  }`}
                                >
                                  {action.name || action.target_page_slug || "Page"}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const firstAction = group.actions[0] || null;
                                if (firstAction) {
                                  setFooterEditorMode("edit");
                                  setSelectedActionId(firstAction.id);
                                  setActiveActionPlacement("footer");
                                  setActionEditorOpen(true);
                                }
                              }}
                              className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
                                isSelected
                                  ? "bg-white/10 text-white hover:bg-white/20"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                              title="Edit segment"
                            >
                              <PiNotePencil className="size-4" />
                            </button>

                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeFooterGroup(group.group_key);
                              }}
                              className="inline-flex h-9 items-center gap-2 rounded-xl bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                              title="Delete segment"
                            >
                              <PiTrash className="size-4" />
                            </button>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )
              ) : activeActionGroupActions.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-950">No items yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Add the first menu item for this area.
                  </p>
                </div>
              ) : (
                activeActionGroupActions.map((action, index) => {
                  const isSelected = selectedAction?.id === action.id;

                  return (
                    <button
                      key={action.id}
                      type="button"
                      ref={(node) => {
                        if (node) {
                          actionCardRefs.current.set(action.id, node);
                        } else {
                          actionCardRefs.current.delete(action.id);
                        }
                      }}
                      draggable
                      onDragStart={() => setDraggedActionId(action.id)}
                      onDragEnd={() => setDraggedActionId(null)}
                      onDragOver={(event) => {
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        reorderActionGroup(draggedActionId, action.id);
                        setDraggedActionId(null);
                      }}
                      onClick={() => {
                        setSelectedActionId(action.id);
                        setActiveActionPlacement(normalizeActionPlacement(action.placement));
                        setActionEditorOpen(true);
                      }}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-slate-950 bg-slate-950 text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
                            isSelected ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"
                          }`}
                          title="Drag to reorder"
                        >
                          <PiDotsSixVertical className="size-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold leading-6">
                            {action.name || "Untitled Link"}
                          </p>
                          <p className={`mt-1 truncate text-xs ${isSelected ? "text-slate-300" : "text-slate-500"}`}>
                            {action.slug || "slug"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedActionId(action.id);
                              setActionEditorOpen(true);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-white/10 text-white hover:bg-white/20"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                            title="Edit"
                          >
                            <PiNotePencil className="size-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeAction(action.id);
                            }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                              isSelected
                                ? "bg-white/10 text-white hover:bg-white/20"
                                : "bg-white text-rose-500 ring-1 ring-slate-200 hover:bg-rose-50"
                            }`}
                            title="Delete"
                          >
                            <PiTrash className="size-4" />
                          </button>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>
      )}

      {actionEditorOpen && actionEditorAction ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu item editor"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            onClick={closeActionEditor}
          />

          <div className="absolute right-0 top-0 flex h-full w-full max-w-[980px] flex-col border-l border-slate-200 bg-white shadow-[0_24px_90px_-18px_rgba(15,23,42,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? "Footer Segment" : "Menu Item"}
                </p>
                <h3 className="mt-2 truncate text-xl font-bold text-slate-950">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer"
                    ? footerGroupDraft.title || "Untitled Group"
                    : actionEditorAction.name || "Untitled Link"}
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  {normalizeActionPlacement(actionEditorAction.placement) === "footer"
                    ? "Group pages into a footer column and manage the links from one panel."
                    : "Edit the selected menu item in a large drawer without leaving the canvas."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeActionEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                title="Close"
              >
                <PiArrowLeft className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Group Title" hint="This becomes the footer column heading">
                        <input
                          className={inputClassName}
                          list="footer-group-suggestions"
                          placeholder="Information"
                          value={footerGroupDraft.title || ""}
                          onChange={(e) =>
                            setFooterGroupDraft((prev) => ({
                              ...prev,
                              title: e.target.value,
                            }))
                          }
                        />
                      </Field>

                      <Field label="Group Note" hint="Optional helper text for this group">
                        <input
                          className={inputClassName}
                          placeholder="Top navigation and utility links"
                          value={footerGroupDraft.note || ""}
                          onChange={(e) =>
                            setFooterGroupDraft((prev) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <datalist id="footer-group-suggestions">
                      {footerGroupSuggestions.map((group) => (
                        <option key={group} value={group} />
                      ))}
                    </datalist>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Pages in this segment</p>
                          <p className="mt-1 text-sm text-slate-500">
                            Pick the storefront pages that should appear under this footer column.
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                          {footerGroupDraft.target_page_ids.length} selected
                        </span>
                      </div>

                      <div className="mt-4 grid max-h-[340px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                        {pages.map((page) => {
                          const pageId = String(page.id);
                          const isChecked = footerGroupDraft.target_page_ids.includes(pageId);

                          return (
                            <label
                              key={page.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                isChecked
                                  ? "border-slate-950 bg-slate-950 text-white shadow-[0_16px_32px_-24px_rgba(15,23,42,0.55)]"
                                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 rounded border-slate-300"
                                checked={isChecked}
                                onChange={(event) => {
                                  const nextIds = event.target.checked
                                    ? [...footerGroupDraft.target_page_ids, pageId]
                                    : footerGroupDraft.target_page_ids.filter((id) => id !== pageId);

                                  setFooterGroupDraft((prev) => ({
                                    ...prev,
                                    target_page_ids: Array.from(new Set(nextIds)),
                                  }));
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{page.name}</span>
                                <span className={`block text-xs ${isChecked ? "text-slate-300" : "text-slate-500"}`}>
                                  {page.slug ? `/${page.slug}` : "/"}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Link Type">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.link_type || "custom_path"}
                          onChange={(e) => updateActionField(actionEditorAction.id, "link_type", e.target.value)}
                        >
                          {STOREFRONT_LINK_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Name">
                        <input
                          className={inputClassName}
                          value={actionEditorAction.name || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "name", e.target.value)}
                        />
                      </Field>

                      <Field label="Slug" hint="Valid slug only">
                        <input
                          className={inputClassName}
                          value={actionEditorAction.slug || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "slug", e.target.value)}
                        />
                      </Field>
                    </div>

                    {actionEditorAction.link_type === "internal_route" && (
                      <Field label="Internal Route">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.route_key || "/"}
                          onChange={(e) => updateActionField(actionEditorAction.id, "route_key", e.target.value)}
                        >
                          {STOREFRONT_INTERNAL_ROUTE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {actionEditorAction.link_type === "storefront_page" && (
                      <Field label="Target Page">
                        <select
                          className={inputClassName}
                          value={actionEditorAction.target_page_id || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "target_page_id", e.target.value)}
                        >
                          <option value="">Select a page</option>
                          {pages.map((page) => (
                            <option key={page.id} value={page.id}>
                              {page.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}

                    {(actionEditorAction.link_type === "custom_path" || actionEditorAction.link_type === "external_url") && (
                      <Field label={actionEditorAction.link_type === "external_url" ? "External URL" : "Custom Path"}>
                        <input
                          className={inputClassName}
                          value={actionEditorAction.expression || ""}
                          onChange={(e) => updateActionField(actionEditorAction.id, "expression", e.target.value)}
                          placeholder={actionEditorAction.link_type === "external_url" ? "https://example.com" : "/about-us"}
                        />
                      </Field>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Token Preview</p>
                      <p className="mt-2 font-mono text-sm text-slate-900">#{actionEditorAction.slug || "slug"}#</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 px-6 py-4">
              <div className="flex items-center justify-between gap-3">
                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                    onClick={() => {
                      if (footerEditorMode === "new") {
                        setFooterEditorMode("edit");
                        setFooterGroupDraft({
                          group_key: "",
                          title: "",
                          note: "",
                          target_page_ids: [],
                        });
                        setActionEditorOpen(false);
                        return;
                      }

                      const footerGroupKey = normalizeFooterGroupKey(footerGroupDraft.group_key || footerGroupDraft.title);
                      updateBuilderList("actions", (items) =>
                        items.filter((action) => {
                          const samePage = action.page_id === selectedPage?.id;
                          const isFooterPlacement = normalizeActionPlacement(action.placement) === "footer";
                          const actionGroupKey = normalizeFooterGroupKey(action.footer_group);
                          if (!samePage || !isFooterPlacement || actionGroupKey !== footerGroupKey) {
                            return true;
                          }
                          return false;
                        })
                      );
                      setActionEditorOpen(false);
                    }}
                  >
                    <PiTrash className="size-4" />
                    Delete segment
                  </button>
                ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={() => {
                      removeAction(actionEditorAction.id);
                      setActionEditorOpen(false);
                    }}
                  >
                    <PiTrash className="size-4" />
                    Delete item
                  </button>
                )}

                {normalizeActionPlacement(actionEditorAction.placement) === "footer" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                    onClick={() => {
                      syncFooterGroupActions({
                        previousGroupKey: footerGroupDraft.group_key || actionEditorAction.footer_group || footerGroupDraft.title,
                        nextGroupTitle: footerGroupDraft.title || actionEditorAction.footer_group || "Footer Group",
                        nextGroupNote: footerGroupDraft.note || "",
                        nextPageIds: footerGroupDraft.target_page_ids,
                      });
                      setFooterEditorMode("edit");
                      setActionEditorOpen(false);
                    }}
                  >
                    Apply changes
                  </button>
                ) : (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
                    onClick={() => setActionEditorOpen(false)}
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

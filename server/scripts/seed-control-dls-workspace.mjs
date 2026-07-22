import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { upsertAssociation } from "../lib/association-model.mjs";
import { initializeProposalQuote } from "../lib/quote-to-cash.mjs";
import { syncReputationReviews } from "../lib/reputation-model.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = path.join(root, "data", "business-db.json");
const backupPath = path.join(root, "data", "backups", "business-db.before-control-dls-seed.json");
const seedAt = "2026-07-22T09:00:00.000Z";

const BRASA_ID = "biz_demo_brasa_norte";
const BRASA_DUPLICATE_ID = "biz_brasa-nort_mpl3awab";
const LUMA_ID = "biz_luma-studio_mqa4u25j";
const REMOVED_TEST_ID = "biz_el-cuelgue-de-santi-temblador_mqyl8698";
const keptBusinessIds = new Set([BRASA_ID, LUMA_ID]);

const db = JSON.parse(await readFile(dbPath, "utf8"));
const brasaOriginal = requireBusiness(db, BRASA_ID);
const brasaDuplicate = findBusiness(db, BRASA_DUPLICATE_ID) || brasaOriginal;
const lumaOriginal = requireBusiness(db, LUMA_ID);

await mkdir(path.dirname(backupPath), { recursive: true });
if (!(await exists(backupPath))) await copyFile(dbPath, backupPath);

const brasa = {
  ...brasaDuplicate,
  ...brasaOriginal,
  id: BRASA_ID,
  slug: "brasa-norte",
  name: "Brasa Norte",
  category: "Restaurante de fuego lento",
  city: "Santander",
  ownerName: "Marta Ruiz",
  ownerEmail: "reservas@brasanorte.es",
  ownerPhone: "+34 942 000 123",
  plan: "growth-local",
  status: "published",
  publishedUrl: "https://brasa-norte.example",
  brand: {
    ...brasaOriginal.brand,
    ...brasaDuplicate.brand,
    accent: "#d45a32",
    theme: "editorial",
    designPack: "custom"
  },
  integrations: mergeObjects(brasaOriginal.integrations, brasaDuplicate.integrations),
  settings: {
    ...brasaOriginal.settings,
    ...brasaDuplicate.settings,
    primaryGoal: "Reservas directas y eventos privados",
    deliveryScore: 100,
    source: "control-dls",
    updatedFromStudioAt: "2026-07-04T16:40:00.000Z"
  },
  content: {
    ...brasaOriginal.content,
    ...brasaDuplicate.content,
    name: "Brasa Norte",
    location: "Santander",
    description: "Cocina de barrio con producto cantabrico, parrilla vista y mesas pensadas para venir sin prisa.",
    services: brasaDuplicate.content?.services || brasaOriginal.content?.services || []
  },
  createdAt: brasaOriginal.createdAt,
  updatedAt: "2026-07-21T17:45:00.000Z",
  archivedAt: ""
};

const luma = {
  ...lumaOriginal,
  ownerName: "Laura Vega",
  plan: "conversion-pro",
  status: "in-review",
  publishedUrl: "",
  settings: {
    ...lumaOriginal.settings,
    primaryGoal: "Reservas online y consultas por WhatsApp",
    deliveryScore: 82,
    source: "control-dls",
    updatedFromStudioAt: "2026-07-21T15:30:00.000Z"
  },
  content: {
    ...lumaOriginal.content,
    name: "Luma Studio",
    location: "Sevilla",
    description: "Estudio de belleza contemporáneo con servicios de color, corte y novias con cita previa.",
    google: {
      ...lumaOriginal.content?.google,
      enabled: true,
      workspaceEmail: "citas@lumastudio.es",
      workspaceDomain: "lumastudio.es",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34954000781",
      rating: 4.7,
      reviewCount: 186
    }
  },
  updatedAt: "2026-07-21T15:30:00.000Z",
  archivedAt: ""
};

db.businesses = [brasa, luma];

brasa.content.commerce = commerceWorkspace({
  orderEmail: "reservas@brasanorte.es",
  deliveryMode: "Recogida en el local",
  products: [
    commerceProduct("product_brasa_menu_two", "BN-MENU-2", "Menú brasa para dos", 38, 12, "Experiencias", "Pack de temporada preparado para recoger."),
    commerceProduct("product_brasa_gift", "BN-REGALO-50", "Tarjeta regalo", 50, 40, "Regalos", "Crédito para comidas y celebraciones."),
    commerceProduct("product_brasa_wine", "BN-VINO-01", "Selección de vino local", 16.5, 4, "Bodega", "Botella elegida por el equipo de sala.")
  ],
  orders: [
    commerceOrder("order_brasa_1028", "BN-1028", "Nuria Gómez", "nuria.gomez@example.com", 38, "ready", "2026-07-22T08:18:00.000Z"),
    commerceOrder("order_brasa_1027", "BN-1027", "Javier Ortiz", "javier.ortiz@example.com", 50, "fulfilled", "2026-07-20T17:40:00.000Z")
  ],
  coupons: [commerceCoupon("coupon_brasa_bienvenida", "BIENVENIDA10", "percent", 10, 30, 100, 7, "2026-08-31T23:59:59.000Z")]
});

luma.content.commerce = commerceWorkspace({
  orderEmail: "citas@lumastudio.es",
  deliveryMode: "Recogida en Luma Studio",
  products: [
    commerceProduct("product_luma_serum", "LS-SERUM-01", "Sérum protector de calor", 24.9, 4, "Cuidado", "Protección y brillo para uso diario."),
    commerceProduct("product_luma_mask", "LS-MASK-01", "Mascarilla reparadora", 29.5, 9, "Cuidado", "Tratamiento nutritivo para cabello coloreado."),
    commerceProduct("product_luma_gift", "LS-REGALO-60", "Bono regalo Luma", 60, 25, "Regalos", "Bono digital para servicios del salón.")
  ],
  orders: [
    commerceOrder("order_luma_0314", "LS-0314", "Elena Mora", "elena.mora@example.com", 29.5, "preparing", "2026-07-22T07:35:00.000Z"),
    commerceOrder("order_luma_0313", "LS-0313", "Marina Soto", "marina.soto@example.com", 60, "fulfilled", "2026-07-19T10:20:00.000Z")
  ],
  coupons: [commerceCoupon("coupon_luma_verano", "VERANO15", "percent", 15, 40, 80, 11, "2026-08-15T23:59:59.000Z")]
});

db.contacts = [
  contact("contact_brasa_marta", BRASA_ID, "Marta Ruiz", "+34 942 000 123", "reservas@brasanorte.es", "customer", "customer", "alta", "Dirección del negocio y contacto principal del proyecto DLS.", "2026-07-21T17:40:00.000Z"),
  contact("contact_brasa_sofia", BRASA_ID, "Sofia Martin", "+34 611 000 214", "sofia.martin@example.com", "customer", "customer", "media", "Cliente recurrente; suele reservar para cuatro personas.", "2026-07-19T22:10:00.000Z"),
  contact("contact_brasa_david", BRASA_ID, "David Cano", "+34 622 000 481", "david.cano@example.com", "lead", "waiting", "alta", "Consulta para una cena de empresa de 18 personas.", "2026-07-22T08:35:00.000Z"),
  contact("contact_brasa_nuria", BRASA_ID, "Nuria Gomez", "+34 633 000 752", "nuria.gomez@example.com", "lead", "reserved", "media", "Reserva confirmada desde la web.", "2026-07-21T18:20:00.000Z"),
  contact("contact_luma_laura", LUMA_ID, "Laura Vega", "+34 954 000 781", "citas@lumastudio.es", "customer", "customer", "alta", "Dirección de Luma Studio y responsable de validaciones.", "2026-07-21T15:30:00.000Z"),
  contact("contact_luma_elena", LUMA_ID, "Elena Mora", "+34 644 000 153", "elena.mora@example.com", "customer", "customer", "media", "Cliente habitual de color y tratamientos.", "2026-07-18T17:20:00.000Z"),
  contact("contact_luma_claudia", LUMA_ID, "Claudia Rey", "+34 655 000 926", "claudia.rey@example.com", "lead", "reserved", "alta", "Prueba de novia reservada; pendiente confirmar acompañante.", "2026-07-22T07:50:00.000Z"),
  contact("contact_luma_ines", LUMA_ID, "Ines Molina", "+34 666 000 347", "ines.molina@example.com", "lead", "contacted", "media", "Pidió información de balayage desde Instagram.", "2026-07-21T12:15:00.000Z")
];

db.activities = [
  activity("activity_brasa_kickoff", BRASA_ID, "contact_brasa_marta", "project.kickoff", "Kickoff completado", "Objetivos, accesos y calendario validados con Marta.", "control-dls", "2026-06-08T09:30:00.000Z"),
  activity("activity_brasa_publish", BRASA_ID, "contact_brasa_marta", "project.published", "Web publicada", "Web, reservas y analitica quedaron activas.", "control-dls", "2026-07-04T16:40:00.000Z"),
  activity("activity_brasa_event_lead", BRASA_ID, "contact_brasa_david", "lead_form_submit", "Nueva consulta de grupo", "Cena de empresa para 18 personas en septiembre.", "web", "2026-07-22T08:35:00.000Z"),
  activity("activity_luma_kickoff", LUMA_ID, "contact_luma_laura", "project.kickoff", "Kickoff y contenidos", "Recibidos logotipo, carta de servicios y referencias visuales.", "control-dls", "2026-06-15T10:00:00.000Z"),
  activity("activity_luma_review", LUMA_ID, "contact_luma_laura", "project.review_requested", "Primera revisión enviada", "Landing, agenda y versión móvil listas para comentarios.", "control-dls", "2026-07-21T15:30:00.000Z"),
  activity("activity_luma_instagram", LUMA_ID, "contact_luma_ines", "contact.created", "Lead desde Instagram", "Consulta de balayage; seguimiento programado.", "instagram", "2026-07-21T12:15:00.000Z")
];

db.proposals = [
  proposal({
    id: "proposal_brasa_growth",
    businessId: BRASA_ID,
    contactId: "contact_brasa_marta",
    package: "growth_local",
    title: "Web, reservas y crecimiento local",
    setupPrice: 1450,
    monthlyPrice: 149,
    conditions: "Diseño y publicación web, reservas, CRM, analítica, hosting, mantenimiento y soporte mensual.",
    expiresAt: "2026-06-30T23:59:59.000Z",
    status: "aceptada",
    acceptedAt: "2026-06-05T12:20:00.000Z",
    createdAt: "2026-06-02T09:15:00.000Z",
    updatedAt: "2026-06-05T12:20:00.000Z"
  }),
  proposal({
    id: "proposal_luma_conversion",
    businessId: LUMA_ID,
    contactId: "contact_luma_laura",
    package: "conversion_pro",
    title: "Presencia digital y agenda de citas",
    setupPrice: 1200,
    monthlyPrice: 99,
    conditions: "Dirección visual, web responsive, agenda, WhatsApp, hosting, mantenimiento y soporte.",
    expiresAt: "2026-06-20T23:59:59.000Z",
    status: "aceptada",
    acceptedAt: "2026-06-13T11:10:00.000Z",
    createdAt: "2026-06-11T16:00:00.000Z",
    updatedAt: "2026-06-13T11:10:00.000Z"
  }),
  proposal({
    id: "proposal_luma_content",
    businessId: LUMA_ID,
    contactId: "contact_luma_laura",
    package: "custom",
    title: "Contenido visual mensual",
    setupPrice: 350,
    monthlyPrice: 89,
    conditions: "Sesión inicial, edición de piezas y actualización mensual de galería y campañas.",
    expiresAt: "2026-08-05T23:59:59.000Z",
    status: "vista",
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-21T13:05:00.000Z"
  })
];

db.projects = [
  project("project_brasa_launch", BRASA_ID, "proposal_brasa_growth", "contact_brasa_marta", "Lanzamiento web y reservas", "Diseño, contenidos, publicación y activación del circuito de reservas directas.", "Luis · DLS", "high", "published", "2026-06-08", "2026-07-04", "2026-07-04T16:40:00.000Z"),
  project("project_brasa_growth", BRASA_ID, "", "contact_brasa_marta", "Primer mes de crecimiento local", "Optimización del perfil local, seguimiento de conversiones y primera campaña de reseñas.", "Equipo DLS", "medium", "maintenance", "2026-07-07", "2026-08-07", "2026-07-21T17:45:00.000Z"),
  project("project_luma_launch", LUMA_ID, "proposal_luma_conversion", "contact_luma_laura", "Web y agenda de Luma Studio", "Identidad aplicada, landing de servicios, captación por WhatsApp y flujo de citas.", "Luis · DLS", "high", "review", "2026-06-15", "2026-07-30", "2026-07-21T15:30:00.000Z")
];

db.projectTasks = [
  task("task_brasa_brief", BRASA_ID, "project_brasa_launch", "Validar brief y objetivos", "Luis", "done", "2026-06-10", "2026-06-10T12:00:00.000Z"),
  task("task_brasa_content", BRASA_ID, "project_brasa_launch", "Cargar carta, horarios y fotografías", "Marta", "done", "2026-06-18", "2026-06-18T18:10:00.000Z"),
  task("task_brasa_site", BRASA_ID, "project_brasa_launch", "Diseñar y montar la web", "Luis", "done", "2026-06-28", "2026-06-28T19:30:00.000Z"),
  task("task_brasa_qa", BRASA_ID, "project_brasa_launch", "QA móvil y publicación", "Equipo DLS", "done", "2026-07-04", "2026-07-04T16:40:00.000Z"),
  task("task_brasa_profile", BRASA_ID, "project_brasa_growth", "Optimizar perfil de Google", "Equipo DLS", "done", "2026-07-15", "2026-07-15T16:00:00.000Z"),
  task("task_brasa_reviews", BRASA_ID, "project_brasa_growth", "Preparar campaña de reseñas", "Marta", "in-progress", "2026-07-25", "2026-07-21T17:45:00.000Z"),
  task("task_brasa_report", BRASA_ID, "project_brasa_growth", "Revisar primer informe mensual", "Luis", "pending", "2026-08-05", "2026-07-21T17:45:00.000Z"),
  task("task_luma_brief", LUMA_ID, "project_luma_launch", "Cerrar arquitectura y contenidos", "Laura", "done", "2026-06-20", "2026-06-20T13:00:00.000Z"),
  task("task_luma_design", LUMA_ID, "project_luma_launch", "Aplicar dirección visual", "Luis", "done", "2026-07-08", "2026-07-08T17:00:00.000Z"),
  task("task_luma_booking", LUMA_ID, "project_luma_launch", "Configurar agenda y servicios", "Equipo DLS", "done", "2026-07-17", "2026-07-17T15:20:00.000Z"),
  task("task_luma_feedback", LUMA_ID, "project_luma_launch", "Aplicar comentarios de la revisión", "Luis", "in-progress", "2026-07-24", "2026-07-21T15:30:00.000Z"),
  task("task_luma_publish", LUMA_ID, "project_luma_launch", "QA final y publicación", "Equipo DLS", "pending", "2026-07-30", "2026-07-21T15:30:00.000Z")
];

db.projectFiles = [
  projectFile("file_brasa_brief", BRASA_ID, "project_brasa_launch", "Brief aprobado · Brasa Norte", "https://files.dls.example/brasa-norte/brief.pdf", "brief", "2026-06-10T12:00:00.000Z"),
  projectFile("file_brasa_delivery", BRASA_ID, "project_brasa_launch", "Acta de publicación", "https://files.dls.example/brasa-norte/publicacion.pdf", "deliverable", "2026-07-04T16:45:00.000Z"),
  projectFile("file_luma_brand", LUMA_ID, "project_luma_launch", "Kit de marca · Luma Studio", "https://files.dls.example/luma-studio/kit-marca.pdf", "brand", "2026-06-18T10:20:00.000Z"),
  projectFile("file_luma_review", LUMA_ID, "project_luma_launch", "Enlace de revisión v1", "https://files.dls.example/luma-studio/revision-v1.pdf", "deliverable", "2026-07-21T15:30:00.000Z")
];

db.projectComments = [
  projectComment("comment_brasa_launch", BRASA_ID, "project_brasa_launch", "Publicación validada. Mantener el botón de reservas visible en móvil.", "client", "2026-07-04T14:15:00.000Z"),
  projectComment("comment_luma_review", LUMA_ID, "project_luma_launch", "Cambiar la foto principal y destacar novias antes de manicura.", "client", "2026-07-21T16:05:00.000Z")
];

db.projectApprovals = [
  projectApproval("approval_brasa_launch", BRASA_ID, "project_brasa_launch", "approved", "Web y reservas aprobadas para publicación.", "client", "2026-07-04T14:20:00.000Z"),
  projectApproval("approval_luma_changes", LUMA_ID, "project_luma_launch", "changes-requested", "Pendientes dos ajustes visuales antes de publicar.", "client", "2026-07-21T16:10:00.000Z")
];

db.subscriptions = [
  subscription("subscription_brasa_growth", BRASA_ID, "proposal_brasa_growth", "project_brasa_launch", "Hosting, CRM y crecimiento local", "Hosting gestionado, mantenimiento, analítica, soporte y mejora mensual.", 149, "2026-08-04", "2026-06-05T12:20:00.000Z"),
  subscription("subscription_luma_care", LUMA_ID, "proposal_luma_conversion", "project_luma_launch", "Hosting, agenda y soporte", "Infraestructura, copias, agenda, mantenimiento y soporte de Luma Studio.", 99, "2026-08-13", "2026-06-13T11:10:00.000Z")
];

db.invoices = [
  invoice("invoice_dls_2026_0001", BRASA_ID, "project_brasa_launch", "proposal_brasa_growth", "DLS-2026-0001", "Diseño, desarrollo y publicación web", "2026-06-05", "2026-06-12", 1450, 21, "paid", "2026-06-05T12:25:00.000Z"),
  invoice("invoice_dls_2026_0002", LUMA_ID, "project_luma_launch", "proposal_luma_conversion", "DLS-2026-0002", "Primer pago · web y agenda de citas", "2026-06-13", "2026-06-20", 600, 21, "paid", "2026-06-13T11:15:00.000Z"),
  invoice("invoice_dls_2026_0003", BRASA_ID, "project_brasa_growth", "", "DLS-2026-0003", "Servicio mensual de crecimiento local · julio", "2026-07-15", "2026-07-29", 149, 21, "sent", "2026-07-15T09:00:00.000Z"),
  invoice("invoice_dls_2026_0004", LUMA_ID, "project_luma_launch", "proposal_luma_conversion", "DLS-2026-0004", "Pago final · web y agenda de citas", "2026-07-18", "2026-07-30", 600, 21, "sent", "2026-07-18T10:00:00.000Z")
];

db.payments = [
  payment("payment_dls_0001", BRASA_ID, "invoice_dls_2026_0001", 1754.5, "2026-06-09T10:12:00.000Z", "transfer", "TRX-BRASA-0609"),
  payment("payment_dls_0002", LUMA_ID, "invoice_dls_2026_0002", 726, "2026-06-16T09:45:00.000Z", "transfer", "TRX-LUMA-0616")
];

db.documents = [
  document("document_brasa_contract", BRASA_ID, "project_brasa_launch", "", "proposal_brasa_growth", "Contrato firmado · Brasa Norte", "contract", "https://files.dls.example/brasa-norte/contrato-firmado.pdf", "client", "2026-06-05T12:20:00.000Z"),
  document("document_brasa_delivery", BRASA_ID, "project_brasa_launch", "invoice_dls_2026_0001", "", "Entrega y accesos · Brasa Norte", "deliverable", "https://files.dls.example/brasa-norte/entrega-accesos.pdf", "client", "2026-07-04T16:45:00.000Z"),
  document("document_luma_contract", LUMA_ID, "project_luma_launch", "", "proposal_luma_conversion", "Contrato firmado · Luma Studio", "contract", "https://files.dls.example/luma-studio/contrato-firmado.pdf", "client", "2026-06-13T11:10:00.000Z"),
  document("document_luma_review", LUMA_ID, "project_luma_launch", "", "", "Revisión visual v1 · Luma Studio", "deliverable", "https://files.dls.example/luma-studio/revision-visual-v1.pdf", "client", "2026-07-21T15:30:00.000Z"),
  document("document_luma_notes", LUMA_ID, "project_luma_launch", "", "", "Notas internas de publicación", "other", "https://files.dls.example/luma-studio/notas-internas.pdf", "internal", "2026-07-21T17:00:00.000Z")
];

db.teamMembers = [
  teamMember("team_brasa_marta", BRASA_ID, "Marta Ruiz", "owner", "2026-06-05T12:20:00.000Z"),
  teamMember("team_brasa_diego", BRASA_ID, "Diego Torres", "manager", "2026-07-04T10:00:00.000Z"),
  teamMember("team_brasa_paula", BRASA_ID, "Paula Sainz", "employee", "2026-07-06T09:00:00.000Z"),
  teamMember("team_brasa_hugo", BRASA_ID, "Hugo Cobo", "employee", "2026-07-06T09:05:00.000Z"),
  teamMember("team_luma_laura", LUMA_ID, "Laura Vega", "owner", "2026-06-13T11:10:00.000Z"),
  teamMember("team_luma_carmen", LUMA_ID, "Carmen Rios", "manager", "2026-07-17T12:00:00.000Z"),
  teamMember("team_luma_alicia", LUMA_ID, "Alicia Mora", "employee", "2026-07-17T12:05:00.000Z"),
  teamMember("team_luma_noelia", LUMA_ID, "Noelia Gil", "employee", "2026-07-17T12:10:00.000Z")
];

db.hospitalitySuppliers = [
  hospitalitySupplier("supplier_brasa_cantabrico", BRASA_ID, "Pescados del Cantábrico", "B39812041", "pedidos@pescadoscantabrico.example", "+34 942 310 410", "Pescado y marisco"),
  hospitalitySupplier("supplier_brasa_huerta", BRASA_ID, "Huerta de Trasmiera", "B39520187", "reparto@huertatrasmiera.example", "+34 942 620 118", "Fruta y verdura"),
  hospitalitySupplier("supplier_brasa_bodega", BRASA_ID, "Bodega Costa Norte", "B39710452", "ventas@bodegacostanorte.example", "+34 942 810 224", "Bebidas"),
  hospitalitySupplier("supplier_luma_profesional", LUMA_ID, "Cantabria Hair Pro", "B39601742", "pedidos@hairpro.example", "+34 942 541 800", "Color y tratamientos"),
  hospitalitySupplier("supplier_luma_cosmetica", LUMA_ID, "Cosmética Serena", "B39411802", "hola@cosmeticserena.example", "+34 942 508 110", "Cosmética"),
  hospitalitySupplier("supplier_luma_textil", LUMA_ID, "Textil Salón Norte", "B39265044", "pedidos@textilsalonnorte.example", "+34 942 620 730", "Consumibles"),
];

db.hospitalityEmployees = [
  hospitalityEmployee("employee_brasa_marta", BRASA_ID, "Marta Ruiz", "reservas@brasanorte.es", "+34 942 000 123", "owner", "owner", 0, "#d45a32"),
  hospitalityEmployee("employee_brasa_diego", BRASA_ID, "Diego Torres", "diego@brasanorte.es", "+34 611 210 041", "manager", "manager", 15.5, "#5262d9"),
  hospitalityEmployee("employee_brasa_paula", BRASA_ID, "Paula Sainz", "paula@brasanorte.es", "+34 622 140 820", "chef", "employee", 14.25, "#b45309"),
  hospitalityEmployee("employee_brasa_hugo", BRASA_ID, "Hugo Cobo", "hugo@brasanorte.es", "+34 633 920 114", "waiter", "employee", 11.75, "#15803d"),
  hospitalityEmployee("employee_brasa_lucia", BRASA_ID, "Lucía Peña", "lucia@brasanorte.es", "+34 644 718 025", "waiter", "restricted", 11.5, "#7c3aed"),
  hospitalityEmployee("employee_luma_laura", LUMA_ID, "Laura Vega", "citas@lumastudio.es", "+34 954 000 781", "owner", "owner", 0, "#a8547c"),
  hospitalityEmployee("employee_luma_carmen", LUMA_ID, "Carmen Ríos", "carmen@lumastudio.es", "+34 611 802 401", "manager", "manager", 15, "#5262d9"),
  hospitalityEmployee("employee_luma_alicia", LUMA_ID, "Alicia Mora", "alicia@lumastudio.es", "+34 622 481 775", "admin", "employee", 12.5, "#d97706"),
  hospitalityEmployee("employee_luma_noelia", LUMA_ID, "Noelia Gil", "noelia@lumastudio.es", "+34 633 205 914", "admin", "employee", 12.25, "#15803d")
];

db.hospitalityShifts = [
  hospitalityShift("shift_brasa_20260720_diego", BRASA_ID, "employee_brasa_diego", "2026-07-20", "11:00", "18:00", "floor", "completed", "Apertura y cierre de caja."),
  hospitalityShift("shift_brasa_20260720_paula", BRASA_ID, "employee_brasa_paula", "2026-07-20", "10:00", "17:00", "kitchen", "completed", "Preparación y servicio de comidas."),
  hospitalityShift("shift_brasa_20260721_hugo", BRASA_ID, "employee_brasa_hugo", "2026-07-21", "13:00", "22:00", "floor", "completed"),
  hospitalityShift("shift_brasa_20260721_lucia", BRASA_ID, "employee_brasa_lucia", "2026-07-21", "18:00", "23:30", "floor", "completed"),
  hospitalityShift("shift_brasa_20260722_diego", BRASA_ID, "employee_brasa_diego", "2026-07-22", "12:00", "21:00", "floor", "confirmed", "Responsable del servicio."),
  hospitalityShift("shift_brasa_20260722_paula", BRASA_ID, "employee_brasa_paula", "2026-07-22", "10:30", "18:30", "kitchen", "confirmed"),
  hospitalityShift("shift_brasa_20260722_hugo", BRASA_ID, "employee_brasa_hugo", "2026-07-22", "18:00", "23:30", "floor", "confirmed"),
  hospitalityShift("shift_brasa_20260723_paula", BRASA_ID, "employee_brasa_paula", "2026-07-23", "12:00", "21:00", "kitchen", "scheduled"),
  hospitalityShift("shift_brasa_20260723_lucia", BRASA_ID, "employee_brasa_lucia", "2026-07-23", "18:00", "23:30", "floor", "scheduled"),
  hospitalityShift("shift_brasa_20260724_diego", BRASA_ID, "employee_brasa_diego", "2026-07-24", "13:00", "23:00", "floor", "scheduled"),
  hospitalityShift("shift_brasa_20260724_hugo", BRASA_ID, "employee_brasa_hugo", "2026-07-24", "18:00", "23:30", "bar", "scheduled"),
  hospitalityShift("shift_brasa_20260725_paula", BRASA_ID, "employee_brasa_paula", "2026-07-25", "12:00", "22:00", "kitchen", "scheduled"),
  hospitalityShift("shift_brasa_20260725_lucia", BRASA_ID, "employee_brasa_lucia", "2026-07-25", "18:00", "23:30", "floor", "scheduled"),
  hospitalityShift("shift_brasa_20260726_hugo", BRASA_ID, "employee_brasa_hugo", "2026-07-26", "12:30", "20:30", "floor", "scheduled"),
  hospitalityShift("shift_luma_20260720_carmen", LUMA_ID, "employee_luma_carmen", "2026-07-20", "09:30", "18:00", "floor", "completed"),
  hospitalityShift("shift_luma_20260721_alicia", LUMA_ID, "employee_luma_alicia", "2026-07-21", "09:00", "17:00", "admin", "completed"),
  hospitalityShift("shift_luma_20260721_noelia", LUMA_ID, "employee_luma_noelia", "2026-07-21", "11:00", "19:00", "floor", "completed"),
  hospitalityShift("shift_luma_20260722_laura", LUMA_ID, "employee_luma_laura", "2026-07-22", "09:30", "18:30", "floor", "confirmed"),
  hospitalityShift("shift_luma_20260722_carmen", LUMA_ID, "employee_luma_carmen", "2026-07-22", "11:00", "20:00", "floor", "confirmed"),
  hospitalityShift("shift_luma_20260723_alicia", LUMA_ID, "employee_luma_alicia", "2026-07-23", "09:00", "17:00", "admin", "scheduled"),
  hospitalityShift("shift_luma_20260723_noelia", LUMA_ID, "employee_luma_noelia", "2026-07-23", "11:00", "20:00", "floor", "scheduled"),
  hospitalityShift("shift_luma_20260724_laura", LUMA_ID, "employee_luma_laura", "2026-07-24", "09:30", "18:30", "floor", "scheduled"),
  hospitalityShift("shift_luma_20260725_carmen", LUMA_ID, "employee_luma_carmen", "2026-07-25", "09:00", "17:00", "floor", "scheduled"),
  hospitalityShift("shift_luma_20260725_noelia", LUMA_ID, "employee_luma_noelia", "2026-07-25", "10:00", "18:00", "floor", "scheduled")
];

db.hospitalityInventory = [
  hospitalityInventory("inventory_brasa_vaca", BRASA_ID, "Lomo de vaca madurada", "Carnes", "kg", 8.5, 6, 22.4, "supplier_brasa_cantabrico", "Cámara 1; revisión diaria."),
  hospitalityInventory("inventory_brasa_bonito", BRASA_ID, "Bonito del norte", "Pescado", "kg", 3.2, 5, 17.8, "supplier_brasa_cantabrico", "Stock bajo: reponer antes del viernes."),
  hospitalityInventory("inventory_brasa_tomate", BRASA_ID, "Tomate de temporada", "Verduras", "kg", 11, 6, 3.2, "supplier_brasa_huerta"),
  hospitalityInventory("inventory_brasa_patata", BRASA_ID, "Patata agria", "Verduras", "kg", 18, 10, 1.15, "supplier_brasa_huerta"),
  hospitalityInventory("inventory_brasa_vino", BRASA_ID, "Vino tinto de la casa", "Bebidas", "bottles", 14, 18, 7.6, "supplier_brasa_bodega", "Stock bajo; pedido preparado."),
  hospitalityInventory("inventory_brasa_sidra", BRASA_ID, "Sidra natural", "Bebidas", "bottles", 28, 12, 2.4, "supplier_brasa_bodega"),
  hospitalityInventory("inventory_brasa_carbon", BRASA_ID, "Carbón de encina", "Cocina", "boxes", 9, 5, 13.5, "", "Almacén seco."),
  hospitalityInventory("inventory_brasa_envases", BRASA_ID, "Envases para llevar", "Consumibles", "units", 42, 50, 0.38, "", "Stock bajo para pedidos web."),
  hospitalityInventory("inventory_luma_color_cobre", LUMA_ID, "Color cobre 7.4", "Color", "units", 5, 4, 8.9, "supplier_luma_profesional"),
  hospitalityInventory("inventory_luma_oxidante", LUMA_ID, "Oxidante 20 vol.", "Color", "bottles", 3, 4, 6.5, "supplier_luma_profesional", "Reponer esta semana."),
  hospitalityInventory("inventory_luma_mascarilla", LUMA_ID, "Mascarilla reparadora", "Tratamientos", "units", 7, 3, 12.8, "supplier_luma_cosmetica"),
  hospitalityInventory("inventory_luma_serum", LUMA_ID, "Sérum protector", "Venta", "units", 4, 5, 14.2, "supplier_luma_cosmetica", "Una unidad reservada."),
  hospitalityInventory("inventory_luma_guantes", LUMA_ID, "Guantes de nitrilo", "Consumibles", "boxes", 6, 3, 5.4, "supplier_luma_textil"),
  hospitalityInventory("inventory_luma_toallas", LUMA_ID, "Toallas desechables", "Consumibles", "units", 68, 40, 0.22, "supplier_luma_textil")
];

db.hospitalityInvoices = [
  hospitalityInvoice("hospitality_invoice_brasa_0041", BRASA_ID, "BN-2026-0041", "Empresa Bahía Norte", "B39770124", "Cena de equipo para 20 personas", "2026-07-10", "2026-07-17", 1200, 21, "paid", "transfer"),
  hospitalityInvoice("hospitality_invoice_brasa_0042", BRASA_ID, "BN-2026-0042", "Eventos Sardinero", "B39401228", "Reserva privada de terraza", "2026-07-18", "2026-07-29", 800, 21, "sent", "transfer"),
  hospitalityInvoice("hospitality_invoice_luma_0018", LUMA_ID, "LS-2026-0018", "Claudia Rey", "", "Prueba y servicio de novia", "2026-07-12", "2026-07-12", 320, 21, "paid", "card"),
  hospitalityInvoice("hospitality_invoice_luma_0019", LUMA_ID, "LS-2026-0019", "Estudio Alba", "B90214531", "Servicios de imagen para campaña", "2026-07-20", "2026-07-30", 240, 21, "sent", "transfer")
];

db.hospitalityExpenses = [
  hospitalityExpense("hospitality_expense_brasa_pescado", BRASA_ID, "Compra semanal de pescado", "supplier_brasa_cantabrico", "food", "2026-07-18", 418, 10, "transfer", "paid", true),
  hospitalityExpense("hospitality_expense_brasa_bebidas", BRASA_ID, "Reposición de bodega", "supplier_brasa_bodega", "drinks", "2026-07-20", 302.5, 21, "direct-debit", "paid", true),
  hospitalityExpense("hospitality_expense_brasa_mantenimiento", BRASA_ID, "Revisión del extractor", "", "maintenance", "2026-07-21", 180, 21, "card", "paid", true),
  hospitalityExpense("hospitality_expense_luma_color", LUMA_ID, "Color y oxidantes", "supplier_luma_profesional", "supplies", "2026-07-17", 286, 21, "transfer", "paid", true),
  hospitalityExpense("hospitality_expense_luma_textil", LUMA_ID, "Consumibles de cabina", "supplier_luma_textil", "supplies", "2026-07-20", 96, 21, "card", "paid", true),
  hospitalityExpense("hospitality_expense_luma_campaign", LUMA_ID, "Promoción de agenda de verano", "", "marketing", "2026-07-21", 120, 21, "card", "pending", true)
];

db.communicationThreads = [
  communicationThread("thread_brasa_support", BRASA_ID, "Atención DLS · Brasa Norte", "open", "2026-07-21T10:30:00.000Z", "2026-07-22T08:20:00.000Z", "2026-07-21T10:35:00.000Z"),
  communicationThread("thread_luma_support", LUMA_ID, "Atención DLS · Luma Studio", "closed", "2026-07-18T12:00:00.000Z", "2026-07-18T16:10:00.000Z", "2026-07-18T16:10:00.000Z")
];

db.communicationMessages = [
  communicationMessage("message_brasa_client_1", BRASA_ID, "thread_brasa_support", "client", "Marta Ruiz", "¿Podéis cambiar el menú degustación de agosto cuando os pase los platos?", "2026-07-21T10:30:00.000Z"),
  communicationMessage("message_brasa_dls_1", BRASA_ID, "thread_brasa_support", "developer", "Equipo DLS", "Sí. Envíanos texto y precios y lo dejamos programado esta semana.", "2026-07-21T10:35:00.000Z"),
  communicationMessage("message_brasa_client_2", BRASA_ID, "thread_brasa_support", "client", "Marta Ruiz", "Perfecto, os lo mando hoy por la tarde. También hay una foto nueva de la terraza.", "2026-07-22T08:20:00.000Z"),
  communicationMessage("message_luma_client_1", LUMA_ID, "thread_luma_support", "client", "Laura Vega", "Ya he subido las fotos y la lista definitiva de precios.", "2026-07-18T12:00:00.000Z"),
  communicationMessage("message_luma_dls_1", LUMA_ID, "thread_luma_support", "developer", "Equipo DLS", "Recibido. Está todo incorporado en la revisión que te acabamos de enviar.", "2026-07-18T16:10:00.000Z")
];

db.communicationThreads.push(
  teamThread("thread_brasa_team_service", BRASA_ID, "Servicio de hoy", "Marta Ruiz", "2026-07-22T09:20:00.000Z"),
  teamThread("thread_brasa_team_purchases", BRASA_ID, "Compras y almacén", "Diego Torres", "2026-07-22T08:45:00.000Z"),
  teamThread("thread_luma_team_agenda", LUMA_ID, "Agenda diaria", "Laura Vega", "2026-07-22T08:40:00.000Z"),
  teamThread("thread_luma_team_stock", LUMA_ID, "Producto y pedidos", "Carmen Ríos", "2026-07-21T17:35:00.000Z"),
  customerThread("thread_brasa_whatsapp_david", BRASA_ID, "contact_brasa_david", "whatsapp", "WhatsApp · David Cano", "Cena de empresa para 18", "team_brasa_diego", 1, "2026-07-22T08:35:00.000Z", "2026-07-22T08:42:00.000Z", "2026-07-22T08:42:00.000Z"),
  customerThread("thread_brasa_email_sofia", BRASA_ID, "contact_brasa_sofia", "email", "Email · Sofia Martín", "Cambio de hora de la reserva", "team_brasa_marta", 0, "2026-07-21T16:10:00.000Z", "2026-07-21T16:24:00.000Z", "2026-07-21T16:24:00.000Z"),
  customerThread("thread_luma_whatsapp_claudia", LUMA_ID, "contact_luma_claudia", "whatsapp", "WhatsApp · Claudia Rey", "Prueba de novia", "team_luma_carmen", 0, "2026-07-22T07:50:00.000Z", "2026-07-22T08:02:00.000Z", "2026-07-22T08:02:00.000Z"),
  customerThread("thread_luma_email_ines", LUMA_ID, "contact_luma_ines", "email", "Email · Inés Molina", "Consulta de balayage", "team_luma_laura", 1, "2026-07-21T12:15:00.000Z", "", "2026-07-21T12:15:00.000Z")
);

db.communicationMessages.push(
  communicationMessage("message_brasa_team_1", BRASA_ID, "thread_brasa_team_service", "employee", "Diego Torres", "Hoy tenemos 34 cubiertos confirmados y una mesa de dos a las 19:00.", "2026-07-22T08:55:00.000Z"),
  communicationMessage("message_brasa_team_2", BRASA_ID, "thread_brasa_team_service", "employee", "Paula Sainz", "Mise en place lista. Quedan dos raciones del fuera de carta.", "2026-07-22T09:20:00.000Z"),
  communicationMessage("message_brasa_team_3", BRASA_ID, "thread_brasa_team_purchases", "employee", "Diego Torres", "He dejado preparado el pedido de vino y envases para mañana.", "2026-07-22T08:45:00.000Z"),
  communicationMessage("message_luma_team_1", LUMA_ID, "thread_luma_team_agenda", "employee", "Laura Vega", "Claudia viene a las 15:00 para la prueba de novia. Reservad la zona grande.", "2026-07-22T08:15:00.000Z"),
  communicationMessage("message_luma_team_2", LUMA_ID, "thread_luma_team_agenda", "employee", "Carmen Ríos", "Confirmado. También he llamado a la cita de las 18:30.", "2026-07-22T08:40:00.000Z"),
  communicationMessage("message_luma_team_3", LUMA_ID, "thread_luma_team_stock", "employee", "Carmen Ríos", "Faltan oxidante y sérum. Pedido previsto para el jueves.", "2026-07-21T17:35:00.000Z"),
  customerMessage("message_brasa_whatsapp_david_in", BRASA_ID, "thread_brasa_whatsapp_david", "contact_brasa_david", "whatsapp", "inbound", "David Cano", "Hola, buscamos una cena de empresa para 18 personas el 11 de septiembre.", "wa_brasa_david_1", "delivered", "2026-07-22T08:35:00.000Z"),
  customerMessage("message_brasa_whatsapp_david_out", BRASA_ID, "thread_brasa_whatsapp_david", "contact_brasa_david", "whatsapp", "outbound", "Diego Torres", "Tenemos disponibilidad. Te envío hoy dos propuestas de menú y condiciones de reserva.", "wa_brasa_david_2", "read", "2026-07-22T08:42:00.000Z"),
  customerMessage("message_brasa_email_sofia_in", BRASA_ID, "thread_brasa_email_sofia", "contact_brasa_sofia", "email", "inbound", "Sofia Martín", "¿Podemos mover la reserva del sábado de las 21:30 a las 22:00?", "email_brasa_sofia_1", "delivered", "2026-07-21T16:10:00.000Z", "Cambio de hora de la reserva"),
  customerMessage("message_brasa_email_sofia_out", BRASA_ID, "thread_brasa_email_sofia", "contact_brasa_sofia", "email", "outbound", "Marta Ruiz", "Sí, ya está cambiada a las 22:00. Os esperamos.", "email_brasa_sofia_2", "delivered", "2026-07-21T16:24:00.000Z", "Re: Cambio de hora de la reserva"),
  customerMessage("message_luma_whatsapp_claudia_in", LUMA_ID, "thread_luma_whatsapp_claudia", "contact_luma_claudia", "whatsapp", "inbound", "Claudia Rey", "Confirmo la prueba de hoy. Llevaré una foto del vestido y del tocado.", "wa_luma_claudia_1", "delivered", "2026-07-22T07:50:00.000Z"),
  customerMessage("message_luma_whatsapp_claudia_out", LUMA_ID, "thread_luma_whatsapp_claudia", "contact_luma_claudia", "whatsapp", "outbound", "Carmen Ríos", "Perfecto, Claudia. Tenemos todo preparado para las 15:00.", "wa_luma_claudia_2", "read", "2026-07-22T08:02:00.000Z"),
  customerMessage("message_luma_email_ines_in", LUMA_ID, "thread_luma_email_ines", "contact_luma_ines", "email", "inbound", "Inés Molina", "Me gustaría saber duración y precio aproximado de un balayage para media melena.", "email_luma_ines_1", "delivered", "2026-07-21T12:15:00.000Z", "Consulta de balayage")
);

db.channelConnections = [
  channelConnection("channel_brasa_email", BRASA_ID, "email", "Email Brasa Norte", "reservas@brasanorte.es", 30),
  channelConnection("channel_brasa_whatsapp", BRASA_ID, "whatsapp", "WhatsApp Reservas", "+34942000123", 15),
  channelConnection("channel_luma_email", LUMA_ID, "email", "Email Luma Studio", "citas@lumastudio.es", 45),
  channelConnection("channel_luma_whatsapp", LUMA_ID, "whatsapp", "WhatsApp Citas", "+34954000781", 20)
];

db.channelDeliveryEvents = [
  deliveryEvent("delivery_brasa_david_read", BRASA_ID, "message_brasa_whatsapp_david_out", "wa_brasa_david_2", "read", "2026-07-22T08:44:00.000Z"),
  deliveryEvent("delivery_brasa_sofia_delivered", BRASA_ID, "message_brasa_email_sofia_out", "email_brasa_sofia_2", "delivered", "2026-07-21T16:25:00.000Z"),
  deliveryEvent("delivery_luma_claudia_read", LUMA_ID, "message_luma_whatsapp_claudia_out", "wa_luma_claudia_2", "read", "2026-07-22T08:05:00.000Z")
];

db.services = [
  service("svc_brasa_table", BRASA_ID, "Reserva de mesa", 120, 0, "Reserva estándar para comidas y cenas.", 2, "none", 0),
  service("svc_brasa_tasting", BRASA_ID, "Menú degustación", 150, 65, "Menú de temporada por persona.", 2, "fixed", 20),
  service("svc_brasa_groups", BRASA_ID, "Grupos y eventos", 180, 0, "Solicitud para grupos, celebraciones y empresa.", 10, "none", 0),
  service("svc_luma_color", LUMA_ID, "Coloración y balayage", 180, 110, "Diagnóstico, color y acabado.", 1, "fixed", 25),
  service("svc_luma_cut", LUMA_ID, "Corte y styling", 75, 45, "Corte personalizado y acabado.", 1, "none", 0),
  service("svc_luma_bride", LUMA_ID, "Prueba de novia", 150, 150, "Prueba de peinado y maquillaje con planificación.", 1, "percent", 30)
];

db.bookings = [
  booking("booking_brasa_sofia", BRASA_ID, "contact_brasa_sofia", "svc_brasa_table", "Reserva de mesa", "Sofia Martin", "+34 611 000 214", "sofia.martin@example.com", 4, "2026-07-19T19:30:00.000Z", "2026-07-19T21:30:00.000Z", "completed", 0, "Reserva familiar.", "2026-07-18T09:10:00.000Z"),
  booking("booking_brasa_nuria", BRASA_ID, "contact_brasa_nuria", "svc_brasa_table", "Reserva de mesa", "Nuria Gomez", "+34 633 000 752", "nuria.gomez@example.com", 2, "2026-07-22T19:00:00.000Z", "2026-07-22T21:00:00.000Z", "confirmed", 0, "Mesa tranquila si es posible.", "2026-07-21T18:20:00.000Z"),
  booking("booking_brasa_group", BRASA_ID, "contact_brasa_david", "svc_brasa_groups", "Grupos y eventos", "David Cano", "+34 622 000 481", "david.cano@example.com", 18, "2026-09-11T19:30:00.000Z", "2026-09-11T22:30:00.000Z", "pending", 0, "Cena de empresa; pendiente cerrar menú.", "2026-07-22T08:35:00.000Z"),
  booking("booking_luma_elena", LUMA_ID, "contact_luma_elena", "svc_luma_color", "Coloración y balayage", "Elena Mora", "+34 644 000 153", "elena.mora@example.com", 1, "2026-07-18T14:00:00.000Z", "2026-07-18T17:00:00.000Z", "completed", 110, "Repasar matiz habitual.", "2026-07-15T11:30:00.000Z"),
  booking("booking_luma_claudia", LUMA_ID, "contact_luma_claudia", "svc_luma_bride", "Prueba de novia", "Claudia Rey", "+34 655 000 926", "claudia.rey@example.com", 1, "2026-07-22T15:00:00.000Z", "2026-07-22T17:30:00.000Z", "confirmed", 150, "Traer referencia del vestido y tocado.", "2026-07-20T09:50:00.000Z"),
  booking("booking_luma_ines", LUMA_ID, "contact_luma_ines", "svc_luma_cut", "Corte y styling", "Ines Molina", "+34 666 000 347", "ines.molina@example.com", 1, "2026-07-25T09:00:00.000Z", "2026-07-25T10:15:00.000Z", "pending", 45, "Primera visita desde Instagram.", "2026-07-21T12:15:00.000Z")
];

db.tasks = [
  operationalTask("task_brasa_event_proposal", BRASA_ID, "Preparar propuesta para la cena de empresa", "proposal", "high", "team_brasa_diego", "2026-07-22T12:00:00.000Z", "contact_brasa_david", ["evento", "presupuesto"]),
  operationalTask("task_brasa_confirm_booking", BRASA_ID, "Confirmar la reserva de Nuria", "whatsapp", "normal", "team_brasa_marta", "2026-07-22T16:00:00.000Z", "contact_brasa_nuria", ["reserva"]),
  operationalTask("task_brasa_order_stock", BRASA_ID, "Enviar pedido de vino y envases", "admin", "urgent", "team_brasa_diego", "2026-07-22T10:30:00.000Z", "", ["inventario"]),
  operationalTask("task_brasa_review_report", BRASA_ID, "Revisar métricas del primer mes", "meeting", "normal", "team_brasa_marta", "2026-07-24T09:30:00.000Z", "", ["dls", "informe"]),
  operationalTask("task_luma_reply_ines", LUMA_ID, "Responder la consulta de balayage de Inés", "email", "high", "team_luma_laura", "2026-07-22T10:00:00.000Z", "contact_luma_ines", ["lead", "seguimiento"]),
  operationalTask("task_luma_prepare_bride", LUMA_ID, "Preparar zona para la prueba de novia", "booking", "high", "team_luma_carmen", "2026-07-22T14:30:00.000Z", "contact_luma_claudia", ["cita"]),
  operationalTask("task_luma_stock_order", LUMA_ID, "Pedir oxidante y sérum", "admin", "normal", "team_luma_carmen", "2026-07-23T11:00:00.000Z", "", ["inventario"]),
  operationalTask("task_luma_publish_feedback", LUMA_ID, "Validar ajustes finales de la web", "meeting", "normal", "team_luma_laura", "2026-07-24T16:00:00.000Z", "", ["dls", "web"])
];

db.availability = [
  ...availability(BRASA_ID, [0, 1, 2, 3, 4, 5, 6], "12:00", "23:00"),
  ...availability(LUMA_ID, [1, 2, 3, 4, 5, 6], "09:00", "20:00")
];

db.reputationReviews = [];
db.reputationReplies = [];
db.reputationSyncRuns = [];
db.reviewRequests = [];

syncReputationReviews(db, brasa, {
  provider: "development",
  accountId: "google_brasa_norte",
  locationId: "santander_brasa_norte",
  reviews: [
    { reviewId: "brasa_review_248", reviewerName: "Sofia Martín", rating: 5, comment: "Producto excelente, ambiente tranquilo y un trato muy cercano.", createTime: "2026-07-20T20:10:00.000Z", reviewReply: { comment: "Gracias, Sofia. Nos alegra mucho que disfrutarais de la visita.", updateTime: "2026-07-21T09:15:00.000Z" } },
    { reviewId: "brasa_review_247", reviewerName: "Javier Ortiz", rating: 4, comment: "La carne estaba muy buena y la reserva fue sencilla.", createTime: "2026-07-18T13:25:00.000Z", reviewReply: { comment: "Gracias por compartirlo, Javier. Te esperamos de nuevo pronto.", updateTime: "2026-07-18T17:40:00.000Z" } },
    { reviewId: "brasa_review_246", reviewerName: "Lucía Merino", rating: 3, comment: "Buena comida, aunque esperamos algo más entre platos.", createTime: "2026-07-21T19:00:00.000Z" },
    { reviewId: "brasa_review_245", reviewerName: "Carlos Díaz", rating: 5, comment: "Menú cuidado, sala agradable y servicio atento.", createTime: "2026-07-16T21:30:00.000Z" }
  ]
}, seedAt);

syncReputationReviews(db, luma, {
  provider: "development",
  accountId: "google_luma_studio",
  locationId: "sevilla_luma_studio",
  reviews: [
    { reviewId: "luma_review_186", reviewerName: "Elena Mora", rating: 5, comment: "Color precioso, atención muy profesional y cita puntual.", createTime: "2026-07-19T17:40:00.000Z", reviewReply: { comment: "Gracias, Elena. Ha sido un placer verte de nuevo.", updateTime: "2026-07-20T08:50:00.000Z" } },
    { reviewId: "luma_review_185", reviewerName: "Marina Soto", rating: 5, comment: "El corte quedó justo como quería y el local es muy agradable.", createTime: "2026-07-17T12:20:00.000Z", reviewReply: { comment: "Gracias por confiar en Luma, Marina.", updateTime: "2026-07-17T16:00:00.000Z" } },
    { reviewId: "luma_review_184", reviewerName: "Paula León", rating: 4, comment: "Buen resultado y explicaciones claras sobre el cuidado en casa.", createTime: "2026-07-21T11:45:00.000Z" },
    { reviewId: "luma_review_183", reviewerName: "Irene Casas", rating: 5, comment: "Muy contenta con el peinado y con la facilidad para reservar.", createTime: "2026-07-15T18:05:00.000Z" }
  ]
}, seedAt);

db.associations = [];
associate("association_brasa_contact_proposal", BRASA_ID, "contact", "contact_brasa_marta", "proposal", "proposal_brasa_growth", "primary", true, "2026-06-05T12:20:00.000Z");
associate("association_brasa_proposal_project", BRASA_ID, "proposal", "proposal_brasa_growth", "project", "project_brasa_launch", "related", false, "2026-06-08T09:30:00.000Z");
associate("association_brasa_contact_project", BRASA_ID, "contact", "contact_brasa_marta", "project", "project_brasa_launch", "customer", true, "2026-06-08T09:30:00.000Z");
associate("association_brasa_project_invoice", BRASA_ID, "project", "project_brasa_launch", "invoice", "invoice_dls_2026_0001", "billing", true, "2026-06-05T12:25:00.000Z");
associate("association_luma_contact_proposal", LUMA_ID, "contact", "contact_luma_laura", "proposal", "proposal_luma_conversion", "primary", true, "2026-06-13T11:10:00.000Z");
associate("association_luma_contact_content", LUMA_ID, "contact", "contact_luma_laura", "proposal", "proposal_luma_content", "primary", true, "2026-07-18T10:00:00.000Z");
associate("association_luma_proposal_project", LUMA_ID, "proposal", "proposal_luma_conversion", "project", "project_luma_launch", "related", false, "2026-06-15T10:00:00.000Z");
associate("association_luma_contact_project", LUMA_ID, "contact", "contact_luma_laura", "project", "project_luma_launch", "customer", true, "2026-06-15T10:00:00.000Z");
associate("association_luma_project_invoice", LUMA_ID, "project", "project_luma_launch", "invoice", "invoice_dls_2026_0004", "billing", true, "2026-07-18T10:00:00.000Z");

const seededCollections = new Set([
  "businesses", "contacts", "activities", "associations", "proposals", "projects", "projectTasks", "projectFiles",
  "projectComments", "projectApprovals", "subscriptions", "invoices", "payments", "documents", "teamMembers",
  "communicationThreads", "communicationMessages", "channelConnections", "channelDeliveryEvents", "services", "bookings", "availability", "tasks",
  "hospitalityInvoices", "hospitalityExpenses", "hospitalitySuppliers", "hospitalityEmployees", "hospitalityShifts", "hospitalityInventory", "auditLog",
  "reputationReviews", "reputationReplies", "reputationSyncRuns", "reviewRequests"
]);

for (const [key, value] of Object.entries(db)) {
  if (!Array.isArray(value) || seededCollections.has(key)) continue;
  db[key] = value.filter((item) => !item?.businessId || keptBusinessIds.has(item.businessId));
}

db.auditLog = (Array.isArray(db.auditLog) ? db.auditLog : [])
  .filter((entry) => keptBusinessIds.has(entry.businessId) && !String(entry.id || "").startsWith("audit_control_dls_"))
  .concat([
    { id: "audit_control_dls_cleanup", type: "business.cleanup_completed", businessId: BRASA_ID, metadata: { removedBusinessIds: [BRASA_DUPLICATE_ID, REMOVED_TEST_ID], keptBusinessIds: [...keptBusinessIds] }, createdAt: seedAt },
    { id: "audit_control_dls_seed_brasa", type: "workspace.seeded", businessId: BRASA_ID, createdAt: seedAt },
    { id: "audit_control_dls_seed_luma", type: "workspace.seeded", businessId: LUMA_ID, createdAt: seedAt }
  ]);

db.version = Math.max(1, Number(db.version || 1));
db.updatedAt = seedAt;

validateSeed(db);
await writeFile(dbPath, `${JSON.stringify(db, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  backup: path.relative(root, backupPath),
  keptBusinesses: db.businesses.map(({ id, name, status }) => ({ id, name, status })),
  removedBusinesses: [BRASA_DUPLICATE_ID, REMOVED_TEST_ID],
  totals: {
    projects: db.projects.length,
    proposals: db.proposals.length,
    subscriptions: db.subscriptions.length,
    invoices: db.invoices.length,
    payments: db.payments.length,
    documents: db.documents.length,
    communicationThreads: db.communicationThreads.length,
    channelConnections: db.channelConnections.length,
    teamMembers: db.teamMembers.length,
    employees: db.hospitalityEmployees.length,
    shifts: db.hospitalityShifts.length,
    inventoryItems: db.hospitalityInventory.length,
    suppliers: db.hospitalitySuppliers.length,
    operationalTasks: db.tasks.length,
    reputationReviews: db.reputationReviews.length,
    contacts: db.contacts.length,
    bookings: db.bookings.length
  }
}, null, 2));

function requireBusiness(database, id) {
  const business = findBusiness(database, id);
  if (!business) throw new Error(`Required business not found: ${id}`);
  return business;
}

function findBusiness(database, id) {
  return (database.businesses || []).find((item) => item.id === id);
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mergeObjects(left, right) {
  const result = { ...(left || {}) };
  for (const [key, value] of Object.entries(right || {})) {
    result[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeObjects(result[key], value)
      : value;
  }
  return result;
}

function contact(id, businessId, name, phone, email, type, status, priority, notes, lastInteractionAt) {
  return {
    id, businessId, type, name, phone, email, source: "control-dls", utmSource: "", utmMedium: "", utmCampaign: "", firstLandingPage: "",
    firstReferrer: "", status, lostReason: "", merged: false, mergedInto: "", priority, order: Date.parse(lastInteractionAt), tags: type === "customer" ? ["cliente"] : ["oportunidad"],
    notes, valueEstimate: 0, privacyAccepted: true, privacyAcceptedAt: lastInteractionAt, privacyPolicyUrl: "https://dls.example/privacidad",
    customFields: {}, nextAction: null, score: status === "customer" ? 55 : 65, scoreLabel: status === "customer" ? "templado" : "caliente",
    lastInteractionAt, createdAt: lastInteractionAt, updatedAt: lastInteractionAt
  };
}

function activity(id, businessId, contactId, type, title, note, source, createdAt) {
  return { id, businessId, contactId, type, title, note, source, metadata: {}, createdAt };
}

function proposal(input) {
  const item = {
    id: input.id,
    businessId: input.businessId,
    contactId: input.contactId,
    package: input.package,
    setupPrice: input.setupPrice,
    monthlyPrice: input.monthlyPrice,
    conditions: input.conditions,
    expiresAt: input.expiresAt,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt
  };
  initializeProposalQuote(item, { title: input.title, currency: "EUR", signatureRequired: true }, input.createdAt);
  item.publicState = {
    ...item.publicState,
    firstViewedAt: input.status === "vista" ? input.updatedAt : "",
    lastViewedAt: input.status === "vista" ? input.updatedAt : "",
    viewCount: input.status === "vista" ? 2 : 0,
    acceptedAt: input.acceptedAt || ""
  };
  return item;
}

function project(id, businessId, proposalId, contactId, name, description, responsible, priority, status, startDate, dueDate, updatedAt) {
  return { id, businessId, proposalId, contactId, name, description, responsible, priority, status, startDate, dueDate, createdAt: `${startDate}T09:00:00.000Z`, updatedAt };
}

function task(id, businessId, projectId, title, assignee, status, dueDate, updatedAt) {
  return { id, businessId, projectId, title, assignee, status, dueDate, createdAt: updatedAt, updatedAt };
}

function projectFile(id, businessId, projectId, name, url, category, createdAt) {
  return { id, businessId, projectId, name, url, category, createdAt, updatedAt: createdAt };
}

function projectComment(id, businessId, projectId, message, actorRole, createdAt) {
  return { id, businessId, projectId, message, actorRole, createdAt, updatedAt: createdAt };
}

function projectApproval(id, businessId, projectId, decision, note, actorRole, createdAt) {
  return { id, businessId, projectId, decision, note, actorRole, createdAt, updatedAt: createdAt };
}

function subscription(id, businessId, proposalId, projectId, name, description, price, nextRenewal, createdAt) {
  return { id, businessId, proposalId, projectId, name, description, price, currency: "EUR", frequency: "monthly", intervalMonths: 1, nextRenewal, status: "active", noticeDays: 20, createdAt, updatedAt: seedAt };
}

function invoice(id, businessId, projectId, proposalId, number, concept, issueDate, dueDate, subtotal, taxRate, status, createdAt) {
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return { id, businessId, projectId, proposalId, number, concept, issueDate, dueDate, subtotal, taxRate, taxAmount, total: roundMoney(subtotal + taxAmount), currency: "EUR", status, createdAt, updatedAt: createdAt };
}

function payment(id, businessId, invoiceId, amount, paidAt, method, reference) {
  return { id, businessId, invoiceId, amount, paidAt, method, reference, createdAt: paidAt, updatedAt: paidAt };
}

function document(id, businessId, projectId, invoiceId, proposalId, name, category, url, visibility, createdAt) {
  return { id, businessId, projectId, invoiceId, proposalId, name, category, url, visibility, uploadedBy: "admin", createdAt, updatedAt: createdAt };
}

function teamMember(id, businessId, name, role, createdAt) {
  return { id, businessId, name, role, active: true, createdByRole: "client", createdAt, updatedAt: createdAt };
}

function communicationThread(id, businessId, title, status, adminReadAt, lastMessageAt, createdAt) {
  return { id, businessId, type: "support", contactId: "", accountId: "", dealId: "", title, status, createdByRole: "client", createdByName: title.includes("Brasa") ? "Marta Ruiz" : "Laura Vega", clientReadAt: lastMessageAt, adminReadAt, lastMessageAt, createdAt, updatedAt: lastMessageAt };
}

function communicationMessage(id, businessId, threadId, senderRole, senderName, body, createdAt) {
  return { id, businessId, threadId, senderRole, senderName, body, attachmentName: "", attachmentUrl: "", createdAt, updatedAt: createdAt };
}

function teamThread(id, businessId, title, createdByName, lastMessageAt) {
  return {
    id, businessId, type: "team", contactId: "", accountId: "", dealId: "", title, status: "open",
    createdByRole: "client", createdByName, clientReadAt: lastMessageAt, adminReadAt: "", lastMessageAt,
    createdAt: lastMessageAt, updatedAt: lastMessageAt
  };
}

function customerThread(id, businessId, contactId, channel, title, subject, assignedToId, unreadCount, firstInboundAt, firstResponseAt, lastMessageAt) {
  return {
    id, businessId, type: "customer", channel, provider: "development", externalConversationId: `${channel}:${contactId}`,
    externalMessageId: "", contactId, accountId: "", dealId: "", assignedToId, title, subject, status: "open", unreadCount,
    firstInboundAt, firstResponseAt, lastInboundAt: firstInboundAt, lastOutboundAt: firstResponseAt, lastMessageAt,
    lastReadAt: unreadCount ? "" : lastMessageAt, lockedById: "", lockedByName: "", lockExpiresAt: "", closedAt: "",
    createdAt: firstInboundAt, updatedAt: lastMessageAt
  };
}

function customerMessage(id, businessId, threadId, contactId, channel, direction, senderName, body, providerMessageId, deliveryStatus, createdAt, subject = "") {
  return {
    id, businessId, threadId, contactId, channel, provider: "development", providerMessageId, externalMessageId: providerMessageId,
    direction, senderRole: direction === "inbound" ? "contact" : "agent", senderName, subject, body, attachments: [],
    deliveryStatus, deliveryError: "", occurredAt: createdAt, createdAt, updatedAt: createdAt
  };
}

function channelConnection(id, businessId, channel, displayName, senderId, firstResponseTargetMinutes) {
  return { id, businessId, channel, provider: "development", displayName, senderId, active: true, firstResponseTargetMinutes, createdAt: seedAt, updatedAt: seedAt };
}

function deliveryEvent(id, businessId, messageId, providerMessageId, status, occurredAt) {
  return { id, businessId, messageId, provider: "development", providerMessageId, status, error: "", occurredAt, createdAt: occurredAt };
}

function hospitalitySupplier(id, businessId, name, taxId, email, phone, category) {
  return { id, businessId, name, taxId, email, phone, category, active: true, createdAt: seedAt, updatedAt: seedAt };
}

function hospitalityEmployee(id, businessId, name, email, phone, role, accessLevel, hourlyRate, color) {
  return { id, businessId, name, email, phone, role, accessLevel, hourlyRate, color, active: true, createdAt: seedAt, updatedAt: seedAt };
}

function hospitalityShift(id, businessId, employeeId, date, startTime, endTime, area, status, notes = "") {
  return { id, businessId, employeeId, date, startTime, endTime, area, status, notes, createdAt: seedAt, updatedAt: seedAt };
}

function hospitalityInventory(id, businessId, name, category, unit, currentStock, minStock, costPerUnit, supplierId, notes = "") {
  return { id, businessId, name, category, unit, currentStock, minStock, costPerUnit, supplierId, active: true, notes, createdAt: seedAt, updatedAt: seedAt };
}

function hospitalityInvoice(id, businessId, number, customerName, customerTaxId, concept, issueDate, dueDate, subtotal, taxRate, status, paymentMethod) {
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return { id, businessId, number, customerName, customerTaxId, concept, issueDate, dueDate, subtotal, taxRate, taxAmount, total: roundMoney(subtotal + taxAmount), currency: "EUR", status, paymentMethod, notes: "", createdAt: `${issueDate}T09:00:00.000Z`, updatedAt: `${issueDate}T09:00:00.000Z` };
}

function hospitalityExpense(id, businessId, concept, supplierId, category, date, subtotal, taxRate, paymentMethod, status, deductible) {
  const taxAmount = roundMoney(subtotal * taxRate / 100);
  return { id, businessId, concept, supplierId, category, date, subtotal, taxRate, taxAmount, total: roundMoney(subtotal + taxAmount), paymentMethod, status, deductible, notes: "", createdAt: `${date}T09:00:00.000Z`, updatedAt: `${date}T09:00:00.000Z` };
}

function operationalTask(id, businessId, title, type, priority, ownerId, dueAt, contactId, tags) {
  return {
    id, businessId, title, description: title, type, status: "pending", priority, ownerId, participantIds: [], dueAt,
    reminderAt: "", recurrence: "none", result: "", dependencyIds: [], tags, source: "control-dls", legacyNextAction: false,
    legacyContactId: contactId, createdAt: seedAt, updatedAt: seedAt, completedAt: "", cancelledAt: "", archivedAt: "", recurrenceParentId: ""
  };
}

function commerceWorkspace({ orderEmail, deliveryMode, products, orders, coupons }) {
  return {
    enabled: true, title: "Compra online", intro: "Catálogo activo para pedidos y bonos.", currency: "EUR", taxRatePercent: 21,
    taxIncluded: true, orderEmail, deliveryMode, successUrl: "", cancelUrl: "", termsUrl: "", privacyUrl: "",
    allowedCountries: ["ES"], shippingMethods: [{ id: "pickup", name: "Recogida en el local", description: "Recogida tras confirmación.", price: 0, active: true, default: true, allowedCountries: ["ES"] }],
    products, orders, coupons, auditLog: [], createdAt: seedAt, updatedAt: seedAt
  };
}

function commerceProduct(id, sku, name, price, stock, category, description) {
  return { id, sku, name, price, compareAtPrice: 0, image: "", description, category, tags: [], stock, active: true, createdAt: seedAt, updatedAt: seedAt };
}

function commerceOrder(id, orderNumber, name, email, total, status, createdAt) {
  return {
    id, orderNumber, status, customer: { name, email, phone: "" }, currency: "EUR", total, totals: { subtotal: total, discount: 0, shipping: 0, tax: 0, total },
    items: [], shippingMethod: { id: "pickup", name: "Recogida en el local", price: 0 }, trackingNumber: "", internalNote: "", customerNote: "",
    inventoryReserved: false, paymentEventIds: [], events: [{ type: "order.created", at: createdAt, actor: "customer" }], createdAt, updatedAt: createdAt
  };
}

function commerceCoupon(id, code, type, value, minSubtotal, usageLimit, used, expiresAt) {
  return { id, code, type, value, minSubtotal, maxDiscount: 0, usageLimit, used, expiresAt, active: true, createdAt: seedAt, updatedAt: seedAt };
}

function service(id, businessId, name, durationMinutes, price, description, defaultPartySize, depositMode, depositValue) {
  return { id, businessId, name, durationMinutes, price, description, requiredResourceTypes: [], defaultPartySize, depositMode, depositValue, guaranteeRequired: false, cancellationWindowHours: 24, noShowFee: 0, active: true, createdAt: seedAt, updatedAt: seedAt };
}

function booking(id, businessId, contactId, serviceId, serviceName, customerName, phone, email, partySize, startsAt, endsAt, status, total, notes, createdAt) {
  const depositRequired = total > 0;
  return {
    id, businessId, contactId, serviceId, serviceName, requiredResourceTypes: [], resourceIds: [], partySize,
    durationMinutes: Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60000), customerName, phone, email, notes,
    utmSource: "control-dls", utmMedium: "seed", utmCampaign: "", firstLandingPage: "", firstReferrer: "", startsAt, endsAt, status,
    source: "dashboard", price: total, total, currency: "EUR", depositMode: depositRequired ? "fixed" : "none", depositValue: depositRequired ? Math.min(25, total) : 0,
    depositRequired, depositAmount: depositRequired ? Math.min(25, total) : 0, depositStatus: depositRequired ? "paid" : "not_required",
    depositPaidAt: depositRequired ? createdAt : "", guaranteeRequired: false, guaranteeStatus: "not_required", cancellationWindowHours: 24,
    noShowFee: 0, waitlistEntryId: "", waitlistOfferId: "", privacyAccepted: true, privacyAcceptedAt: createdAt,
    privacyPolicyUrl: "https://dls.example/privacidad", createdAt, updatedAt: createdAt
  };
}

function availability(businessId, weekdays, startTime, endTime) {
  return weekdays.map((weekday) => ({ id: `availability_${businessId}_${weekday}`, businessId, weekday, startTime, endTime, active: true, createdAt: seedAt, updatedAt: seedAt }));
}

function associate(id, businessId, fromType, fromId, toType, toId, kind, isPrimary, now) {
  upsertAssociation(db, { id, businessId, fromType, fromId, toType, toId, kind, isPrimary, now });
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function validateSeed(database) {
  const businessIds = new Set(database.businesses.map((item) => item.id));
  if (businessIds.size !== 2 || !businessIds.has(BRASA_ID) || !businessIds.has(LUMA_ID)) throw new Error("The cleaned business list is invalid");
  if (database.businesses.some((item) => [BRASA_DUPLICATE_ID, REMOVED_TEST_ID].includes(item.id))) throw new Error("A removed business is still present");

  const normalizedNames = database.businesses.map((item) => item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ""));
  if (new Set(normalizedNames).size !== normalizedNames.length) throw new Error("Duplicate business names remain");

  for (const [key, value] of Object.entries(database)) {
    if (!Array.isArray(value)) continue;
    const ids = value.map((item) => item?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate ids in ${key}`);
    for (const item of value) {
      if (item?.businessId && !businessIds.has(item.businessId)) throw new Error(`Orphan businessId in ${key}: ${item.businessId}`);
    }
  }

  const contacts = new Set(database.contacts.map((item) => item.id));
  const projects = new Set(database.projects.map((item) => item.id));
  const proposals = new Set(database.proposals.map((item) => item.id));
  const invoices = new Map(database.invoices.map((item) => [item.id, item]));
  const threads = new Set(database.communicationThreads.map((item) => item.id));
  const teamMembers = new Set(database.teamMembers.map((item) => item.id));
  const employees = new Set(database.hospitalityEmployees.map((item) => item.id));
  const suppliers = new Set(database.hospitalitySuppliers.map((item) => item.id));
  const messages = new Set(database.communicationMessages.map((item) => item.id));

  database.proposals.forEach((item) => { if (!contacts.has(item.contactId)) throw new Error(`Proposal contact missing: ${item.id}`); });
  database.projects.forEach((item) => {
    if (item.contactId && !contacts.has(item.contactId)) throw new Error(`Project contact missing: ${item.id}`);
    if (item.proposalId && !proposals.has(item.proposalId)) throw new Error(`Project proposal missing: ${item.id}`);
  });
  [...database.projectTasks, ...database.projectFiles, ...database.projectComments, ...database.projectApprovals].forEach((item) => {
    if (!projects.has(item.projectId)) throw new Error(`Project child is orphaned: ${item.id}`);
  });
  database.documents.forEach((item) => {
    if (item.projectId && !projects.has(item.projectId)) throw new Error(`Document project missing: ${item.id}`);
    if (item.invoiceId && !invoices.has(item.invoiceId)) throw new Error(`Document invoice missing: ${item.id}`);
  });
  database.payments.forEach((item) => {
    const target = invoices.get(item.invoiceId);
    if (!target) throw new Error(`Payment invoice missing: ${item.id}`);
    const paid = database.payments.filter((paymentItem) => paymentItem.invoiceId === item.invoiceId).reduce((sum, paymentItem) => sum + Number(paymentItem.amount || 0), 0);
    if (paid > target.total + 0.001) throw new Error(`Invoice overpaid: ${target.id}`);
  });
  database.communicationMessages.forEach((item) => { if (!threads.has(item.threadId)) throw new Error(`Message thread missing: ${item.id}`); });
  database.communicationThreads.forEach((item) => {
    if (item.contactId && !contacts.has(item.contactId)) throw new Error(`Communication contact missing: ${item.id}`);
    if (item.assignedToId && !teamMembers.has(item.assignedToId)) throw new Error(`Communication owner missing: ${item.id}`);
  });
  database.channelDeliveryEvents.forEach((item) => { if (item.messageId && !messages.has(item.messageId)) throw new Error(`Delivery message missing: ${item.id}`); });
  database.hospitalityShifts.forEach((item) => { if (item.employeeId && !employees.has(item.employeeId)) throw new Error(`Shift employee missing: ${item.id}`); });
  database.hospitalityInventory.forEach((item) => { if (item.supplierId && !suppliers.has(item.supplierId)) throw new Error(`Inventory supplier missing: ${item.id}`); });
  database.hospitalityExpenses.forEach((item) => { if (item.supplierId && !suppliers.has(item.supplierId)) throw new Error(`Expense supplier missing: ${item.id}`); });
  database.tasks.forEach((item) => { if (item.ownerId && !teamMembers.has(item.ownerId)) throw new Error(`Task owner missing: ${item.id}`); });
}

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};
type D1Binding = { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]> };

function getDatabase() {
  const db = (globalThis as typeof globalThis & { __DONEEO_DB__?: D1Binding }).__DONEEO_DB__;
  if (!db) throw new Error("Doneeo test database binding is unavailable");
  return db;
}

type WorkOrderInput = {
  public_reference: string;
  request_text: string;
  job_category: string;
  city: string;
  pickup_address?: string;
  delivery_address?: string;
  schedule_text?: string;
  selected_plan?: string;
  team_size?: number;
  pricing?: { total?: number } & Record<string, unknown>;
  equipment_plan?: Record<string, unknown>;
  estimated_duration_min?: number;
  work_plan?: {
    tasks?: Array<{ sequence?: number; title?: string; domain?: string; qualification?: string; completionGate?: string }>;
    timeline?: Array<{ sequence?: number; taskSequence?: number | null; title?: string; description?: string; minutes?: number; isGate?: boolean }>;
    skills?: string[];
    domains?: string[];
    fulfillment?: { mode?: "single_team" | "coordinated_specialists"; groups?: Array<{ id?: string; title?: string; executorRole?: string; taskSequences?: number[]; vehicleRequired?: boolean; handoffAfterTask?: number | null }> };
  };
  route_plan?: { pickup?: string; destination?: string; status?: string; stops?: Array<string | { location?: string; actions?: string[]; access?: Record<string, unknown>; contactName?: string }> };
  work_steps?: string[];
};

async function addEvent(db: D1Binding, workOrderId: number, eventType: string, title: string, detail: string, actor: string, createdAt: string) {
  await db.prepare("INSERT INTO work_order_events (work_order_id,event_type,title,detail,actor,created_at) VALUES (?,?,?,?,?,?)")
    .bind(workOrderId,eventType,title,detail,actor,createdAt).run();
}

async function ensureSchema(db: D1Binding) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS executors (id text PRIMARY KEY NOT NULL,name text NOT NULL,profile_type text NOT NULL,status text DEFAULT 'available' NOT NULL,rating real NOT NULL,completed_jobs integer DEFAULT 0 NOT NULL,location text NOT NULL,service_radius_km integer DEFAULT 20 NOT NULL,team_size integer DEFAULT 1 NOT NULL,lead_eligible integer DEFAULT false NOT NULL,vehicle text,hourly_rate integer NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS skills (id text PRIMARY KEY NOT NULL,name text NOT NULL,category text NOT NULL,regulated integer DEFAULT false NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS equipment_catalog (id text PRIMARY KEY NOT NULL,name text NOT NULL,category text NOT NULL,description text NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS rental_partners (id text PRIMARY KEY NOT NULL,name text NOT NULL,address text NOT NULL,latitude real NOT NULL,longitude real NOT NULL,pickup_lead_minutes integer DEFAULT 20 NOT NULL,delivery_available integer DEFAULT false NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_orders (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,public_reference text NOT NULL UNIQUE,request_text text NOT NULL,category text NOT NULL,city text DEFAULT 'Montréal' NOT NULL,pickup_address text,delivery_address text,schedule_text text,selected_plan text,required_team_size integer DEFAULT 1 NOT NULL,required_skills_json text DEFAULT '[]' NOT NULL,required_equipment_json text DEFAULT '[]' NOT NULL,price integer DEFAULT 0 NOT NULL,status text DEFAULT 'matching' NOT NULL,created_at text NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS executor_skills (executor_id text NOT NULL,skill_id text NOT NULL,level text NOT NULL,PRIMARY KEY(executor_id,skill_id),FOREIGN KEY(executor_id) REFERENCES executors(id),FOREIGN KEY(skill_id) REFERENCES skills(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS executor_equipment (executor_id text NOT NULL,equipment_id text NOT NULL,quantity integer DEFAULT 1 NOT NULL,verified integer DEFAULT true NOT NULL,PRIMARY KEY(executor_id,equipment_id),FOREIGN KEY(executor_id) REFERENCES executors(id),FOREIGN KEY(equipment_id) REFERENCES equipment_catalog(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS rental_inventory (partner_id text NOT NULL,equipment_id text NOT NULL,quantity_available integer DEFAULT 0 NOT NULL,daily_price integer NOT NULL,deposit integer DEFAULT 0 NOT NULL,PRIMARY KEY(partner_id,equipment_id),FOREIGN KEY(partner_id) REFERENCES rental_partners(id),FOREIGN KEY(equipment_id) REFERENCES equipment_catalog(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_order_stops (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,work_order_id integer NOT NULL,stop_order integer NOT NULL,stop_type text NOT NULL,address text NOT NULL,actions_json text DEFAULT '[]' NOT NULL,access_json text DEFAULT '{}' NOT NULL,contact_name text,estimated_minutes integer DEFAULT 0 NOT NULL,FOREIGN KEY(work_order_id) REFERENCES work_orders(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS work_order_stop_order_idx ON work_order_stops(work_order_id,stop_order)"),
    db.prepare("CREATE TABLE IF NOT EXISTS work_order_events (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,work_order_id integer NOT NULL,event_type text NOT NULL,title text NOT NULL,detail text NOT NULL,actor text NOT NULL,created_at text NOT NULL,FOREIGN KEY(work_order_id) REFERENCES work_orders(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS assignments (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,work_order_id integer NOT NULL,executor_id text NOT NULL,role text NOT NULL,is_lead integer DEFAULT false NOT NULL,status text DEFAULT 'offered' NOT NULL,offered_at text NOT NULL,responded_at text,FOREIGN KEY(work_order_id) REFERENCES work_orders(id),FOREIGN KEY(executor_id) REFERENCES executors(id))"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS assignment_order_executor_idx ON assignments(work_order_id,executor_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS equipment_responses (work_order_id integer NOT NULL,executor_id text NOT NULL,equipment_id text NOT NULL,profile_listed integer DEFAULT false NOT NULL,response text DEFAULT 'pending' NOT NULL,responded_at text,PRIMARY KEY(work_order_id,executor_id,equipment_id),FOREIGN KEY(work_order_id) REFERENCES work_orders(id),FOREIGN KEY(executor_id) REFERENCES executors(id),FOREIGN KEY(equipment_id) REFERENCES equipment_catalog(id))"),
    db.prepare("CREATE TABLE IF NOT EXISTS rental_reservations (id integer PRIMARY KEY AUTOINCREMENT NOT NULL,work_order_id integer NOT NULL,partner_id text NOT NULL,equipment_id text NOT NULL,quantity integer DEFAULT 1 NOT NULL,unit_price integer NOT NULL,status text DEFAULT 'reserved' NOT NULL,pickup_by_executor_id text,created_at text NOT NULL,FOREIGN KEY(work_order_id) REFERENCES work_orders(id),FOREIGN KEY(partner_id) REFERENCES rental_partners(id),FOREIGN KEY(equipment_id) REFERENCES equipment_catalog(id),FOREIGN KEY(pickup_by_executor_id) REFERENCES executors(id))"),
  ]);
}

async function seedDatabase() {
  const db = getDatabase();
  await ensureSchema(db);
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO skills (id,name,category,regulated) VALUES ('moving_lead','Moving lead & route coordination','moving',0),('heavy_handling','Heavy-item handling','moving',0),('assembly','Furniture assembly','installation',0),('wall_mounting','Wall mounting','installation',0),('cleaning','Residential cleaning','cleaning',0),('driving','Commercial vehicle driving','moving',0),('elder_support','Practical elder support','elder_support',0)"),
    db.prepare("INSERT OR IGNORE INTO equipment_catalog (id,name,category,description) VALUES ('cargo_van','Cargo van','vehicle','Cargo vehicle suitable for furniture and multi-stop moves'),('pickup_truck','Pickup truck','vehicle','Open-bed vehicle for suitable loads'),('dolly','Furniture dolly','moving','Wheeled platform for heavy-item handling'),('straps','Moving straps','moving','Load restraint and safe carrying straps'),('blankets','Protective blankets','moving','Surface and edge protection'),('loading_ramp','Portable loading ramp','moving','Portable ramp for a loading-height or access gap'),('drill','Cordless drill','installation','Drilling and assembly tool'),('level','Level','installation','Alignment and placement tool'),('stud_finder','Stud finder','installation','Wall framing detection'),('vacuum','Vacuum','cleaning','Residential vacuum cleaner'),('mop','Mop kit','cleaning','Floor cleaning equipment'),('ppe','Safety PPE','safety','Gloves, footwear and task protection')"),
    db.prepare("INSERT OR IGNORE INTO executors (id,name,profile_type,status,rating,completed_jobs,location,service_radius_km,team_size,lead_eligible,vehicle,hourly_rate) VALUES ('alex','Alex M.','solo','available',4.8,126,'Montréal',28,1,1,'Cargo van',48),('samir','Samir K.','solo','available',4.9,97,'Montréal',22,1,0,NULL,42),('maya','Maya T.','solo','available',4.9,112,'Longueuil',25,1,0,NULL,44),('julie','Julie R.','solo','available',4.9,168,'Montréal',18,1,1,'Compact car',52),('nadia','Nadia B.','solo','available',4.9,184,'Montréal',16,1,1,'Compact car',45),('marc_julie','Marc & Julie Moving','team','available',5.0,214,'Montréal',35,2,1,'Cargo van',92),('nord_move','Nord Move','team','busy',4.9,241,'Laval',45,3,1,'Moving truck',138),('homecare','Montréal HomeCare','team','available',4.8,312,'Montréal',25,2,1,'Service van',98)"),
    db.prepare("INSERT OR IGNORE INTO executor_skills (executor_id,skill_id,level) VALUES ('alex','moving_lead','expert'),('alex','driving','expert'),('alex','heavy_handling','experienced'),('samir','heavy_handling','expert'),('maya','heavy_handling','expert'),('julie','assembly','expert'),('julie','wall_mounting','expert'),('nadia','cleaning','expert'),('marc_julie','moving_lead','expert'),('marc_julie','heavy_handling','expert'),('marc_julie','driving','expert'),('nord_move','moving_lead','expert'),('nord_move','heavy_handling','expert'),('nord_move','driving','expert'),('homecare','cleaning','expert')"),
    db.prepare("INSERT OR IGNORE INTO executor_equipment (executor_id,equipment_id,quantity,verified) VALUES ('alex','cargo_van',1,1),('alex','straps',2,1),('alex','blankets',6,1),('samir','dolly',1,1),('samir','straps',2,1),('samir','ppe',1,1),('maya','dolly',1,1),('maya','ppe',1,1),('julie','drill',1,1),('julie','level',1,1),('julie','stud_finder',1,1),('nadia','vacuum',1,1),('nadia','mop',1,1),('marc_julie','cargo_van',1,1),('marc_julie','dolly',1,1),('marc_julie','straps',4,1),('marc_julie','blankets',8,1),('nord_move','dolly',3,1),('nord_move','straps',8,1),('nord_move','blankets',16,1),('homecare','vacuum',2,1),('homecare','mop',2,1)"),
    db.prepare("INSERT OR IGNORE INTO rental_partners (id,name,address,latitude,longitude,pickup_lead_minutes,delivery_available) VALUES ('toolshare_mtl','ToolShare Montréal','7350 Saint-Laurent Boulevard, Montréal',45.5363,-73.6257,20,1),('equipement_roy','Équipement Roy','5150 de la Savane Street, Montréal',45.4973,-73.6524,30,1),('location_sud','Location Rive-Sud','1200 Taschereau Boulevard, Longueuil',45.4903,-73.4931,25,0)"),
    db.prepare("INSERT OR IGNORE INTO rental_inventory (partner_id,equipment_id,quantity_available,daily_price,deposit) VALUES ('toolshare_mtl','dolly',7,18,50),('toolshare_mtl','straps',12,8,20),('toolshare_mtl','blankets',30,12,20),('toolshare_mtl','loading_ramp',4,25,60),('toolshare_mtl','drill',5,22,75),('toolshare_mtl','stud_finder',4,10,25),('equipement_roy','cargo_van',4,89,300),('equipement_roy','pickup_truck',3,79,250),('equipement_roy','dolly',10,16,50),('equipement_roy','vacuum',6,24,60),('location_sud','cargo_van',2,84,300),('location_sud','dolly',5,15,50),('location_sud','blankets',20,10,20),('location_sud','mop',8,9,15)"),
    db.prepare("INSERT OR IGNORE INTO work_orders (public_reference,request_text,category,city,pickup_address,delivery_address,schedule_text,selected_plan,required_team_size,required_skills_json,required_equipment_json,price,status,created_at) VALUES ('DN-DEMO24','Pick up a dining table at IKEA, deliver it downtown, then move the old table to Longueuil','moving','Montréal','IKEA Montréal · 9191 Boulevard Cavendish','175 Sainte-Catherine Street West · Montréal','Tomorrow · 9:00 AM','recommended',2,'[\"moving_lead\",\"heavy_handling\",\"driving\"]','[\"cargo_van\",\"straps\",\"blankets\",\"dolly\"]',290,'team_pending',?)").bind(now),
  ]);
  const demo = await db.prepare("SELECT id FROM work_orders WHERE public_reference = 'DN-DEMO24'").first<{ id: number }>();
  if (demo?.id) {
    await db.batch([
      db.prepare("INSERT OR IGNORE INTO assignments (work_order_id,executor_id,role,is_lead,status,offered_at) VALUES (?,'alex','Team lead · driver',1,'offered',?)").bind(demo.id, now),
      db.prepare("INSERT OR IGNORE INTO assignments (work_order_id,executor_id,role,is_lead,status,offered_at) VALUES (?,'samir','Handling support',0,'offered',?)").bind(demo.id, now),
      db.prepare("INSERT OR IGNORE INTO work_order_stops (work_order_id,stop_order,stop_type,address,actions_json,access_json,estimated_minutes) VALUES (?,1,'pickup','IKEA Montréal · 9191 Boulevard Cavendish','[\"Collect the paid dining table\",\"Record condition before loading\"]','{}',20)").bind(demo.id),
      db.prepare("INSERT OR IGNORE INTO work_order_stops (work_order_id,stop_order,stop_type,address,actions_json,access_json,estimated_minutes) VALUES (?,2,'delivery_pickup','175 Sainte-Catherine Street West · Montréal','[\"Deliver the new table\",\"Collect the old table\"]','{\"elevator\":true}',30)").bind(demo.id),
      db.prepare("INSERT OR IGNORE INTO work_order_stops (work_order_id,stop_order,stop_type,address,actions_json,access_json,estimated_minutes) VALUES (?,3,'delivery','100 Place Charles-Le Moyne · Longueuil','[\"Deliver and place the old table\",\"Record final handoff\"]','{\"stairs\":1}',20)").bind(demo.id),
      db.prepare("INSERT OR IGNORE INTO work_order_events (id,work_order_id,event_type,title,detail,actor,created_at) VALUES (1,?,'order_created','Work order confirmed','Customer authorized the simulated order and Doneeo started matching.','Customer',?)").bind(demo.id, now),
      db.prepare("INSERT OR IGNORE INTO work_order_events (id,work_order_id,event_type,title,detail,actor,created_at) VALUES (2,?,'team_offered','Two solo executors assembled','Alex is lead driver and Samir is handling support. Both must validate independently.','Doneeo',?)").bind(demo.id, now),
    ]);
  }
}

async function snapshot() {
  await seedDatabase();
  const db = getDatabase();
  const [executors, skills, equipment, rentals, workOrders, assignments, reservations, equipmentResponses, stops, events] = await Promise.all([
    db.prepare("SELECT e.*, GROUP_CONCAT(DISTINCT s.name) AS skills, GROUP_CONCAT(DISTINCT ec.name) AS equipment, GROUP_CONCAT(DISTINCT ee.equipment_id) AS equipment_ids FROM executors e LEFT JOIN executor_skills es ON es.executor_id=e.id LEFT JOIN skills s ON s.id=es.skill_id LEFT JOIN executor_equipment ee ON ee.executor_id=e.id LEFT JOIN equipment_catalog ec ON ec.id=ee.equipment_id GROUP BY e.id ORDER BY e.profile_type,e.rating DESC").all(),
    db.prepare("SELECT * FROM skills ORDER BY category,name").all(),
    db.prepare("SELECT * FROM equipment_catalog ORDER BY category,name").all(),
    db.prepare("SELECT rp.id,rp.name,rp.address,rp.pickup_lead_minutes,rp.delivery_available,ri.equipment_id,ec.name AS equipment_name,ri.quantity_available,ri.daily_price,ri.deposit FROM rental_partners rp JOIN rental_inventory ri ON ri.partner_id=rp.id JOIN equipment_catalog ec ON ec.id=ri.equipment_id ORDER BY rp.name,ec.name").all(),
    db.prepare("SELECT * FROM work_orders ORDER BY id DESC LIMIT 20").all(),
    db.prepare("SELECT a.*,e.name AS executor_name,w.public_reference FROM assignments a JOIN executors e ON e.id=a.executor_id JOIN work_orders w ON w.id=a.work_order_id ORDER BY a.id DESC").all(),
    db.prepare("SELECT rr.*,rp.name AS partner_name,ec.name AS equipment_name,w.public_reference FROM rental_reservations rr JOIN rental_partners rp ON rp.id=rr.partner_id JOIN equipment_catalog ec ON ec.id=rr.equipment_id JOIN work_orders w ON w.id=rr.work_order_id ORDER BY rr.id DESC").all(),
    db.prepare("SELECT er.*,e.name AS executor_name,ec.name AS equipment_name,w.public_reference FROM equipment_responses er JOIN executors e ON e.id=er.executor_id JOIN equipment_catalog ec ON ec.id=er.equipment_id JOIN work_orders w ON w.id=er.work_order_id ORDER BY er.responded_at DESC").all(),
    db.prepare("SELECT s.*,w.public_reference FROM work_order_stops s JOIN work_orders w ON w.id=s.work_order_id ORDER BY s.work_order_id DESC,s.stop_order").all(),
    db.prepare("SELECT e.*,w.public_reference FROM work_order_events e JOIN work_orders w ON w.id=e.work_order_id ORDER BY e.id DESC LIMIT 100").all(),
  ]);
  return { executors: executors.results, skills: skills.results, equipment: equipment.results, rentals: rentals.results, workOrders: workOrders.results, assignments: assignments.results, reservations: reservations.results, equipmentResponses: equipmentResponses.results, stops: stops.results, events: events.results };
}

export async function GET() {
  try { return Response.json(await snapshot()); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Database unavailable" }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    await seedDatabase();
    const db = getDatabase();
    const body = await request.json() as { action?: string; payload?: WorkOrderInput; assignmentId?: number; status?: string; reference?: string; workOrderId?: number; equipmentId?: string; executorId?: string; replacementExecutorId?: string; profileListed?: boolean; response?: string };
    const now = new Date().toISOString();
    if (body.action === "create_work_order" && body.payload) {
      const p = body.payload;
      await db.prepare("INSERT INTO work_orders (public_reference,request_text,category,city,pickup_address,delivery_address,schedule_text,selected_plan,required_team_size,required_skills_json,required_equipment_json,price,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
        .bind(p.public_reference,p.request_text,p.job_category,p.city,p.pickup_address || null,p.delivery_address || null,p.schedule_text || null,p.selected_plan || null,p.team_size || 1,JSON.stringify(p.work_plan || { tasks: [], timeline: p.work_steps || [], skills: [], domains: [] }),JSON.stringify(p.equipment_plan || {}),Number(p.pricing?.total || 0),"team_pending",now).run();
      const created = await db.prepare("SELECT id FROM work_orders WHERE public_reference=?").bind(p.public_reference).first<{ id: number }>();
      if (created?.id) {
        const domains = p.work_plan?.domains || [];
        const requestedTeamSize = Math.max(1, p.team_size || 1);
        const mixedHandlingAndMounting = domains.includes("transport_handling") && domains.includes("mounting");
        const coordinatedSpecialists = p.work_plan?.fulfillment?.mode === "coordinated_specialists";
        const matches = coordinatedSpecialists
          ? [["alex","Service A lead · driver · Tasks 1–2",1],["samir","Cross-service handling support · Tasks 1–5",0],["julie","Service B lead · installation and wall mounting · Tasks 3–5",0]]
          : mixedHandlingAndMounting
          ? [["julie","Lead wall-mounting executor",1], ...(requestedTeamSize > 1 ? [["samir","Handling and safe-lift support",0]] : [])]
          : p.job_category === "moving" && requestedTeamSize > 1 ? [["alex","Team lead · driver",1],["samir","Handling support",0]]
          : p.job_category === "installation" ? [["julie","Lead installer",1]]
          : p.job_category === "cleaning" ? [["nadia","Cleaning lead",1]]
          : [["alex","Lead executor",1]];
        const rawStops = p.route_plan?.stops?.length ? p.route_plan.stops : [p.pickup_address || "Pickup to confirm", p.delivery_address || "Destination to confirm"];
        const stopStatements = rawStops.map((rawStop, index) => {
          const stop = typeof rawStop === "string" ? { location: rawStop, actions: [] as string[], access: {} as Record<string, unknown>, contactName: undefined as string | undefined } : rawStop;
          const stopType = rawStops.length === 1 || p.route_plan?.status === "one-property work" ? "service" : index === 0 ? "pickup" : index === rawStops.length - 1 ? "delivery" : "delivery_pickup";
          return db.prepare("INSERT INTO work_order_stops (work_order_id,stop_order,stop_type,address,actions_json,access_json,contact_name,estimated_minutes) VALUES (?,?,?,?,?,?,?,?)")
            .bind(created.id,index + 1,stopType,stop.location || `Stop ${index + 1}`,JSON.stringify(stop.actions || []),JSON.stringify(stop.access || {}),stop.contactName || null,index === 0 ? 20 : 25);
        });
        await db.batch([
          ...matches.map(match => db.prepare("INSERT OR IGNORE INTO assignments (work_order_id,executor_id,role,is_lead,status,offered_at) VALUES (?,?,?,?, 'offered',?)").bind(created.id,match[0],match[1],match[2],now)),
          ...stopStatements,
        ]);
        await addEvent(db,created.id,"order_created","Customer confirmed the work order",`${rawStops.length} ordered stops, ${p.team_size || 1} executor(s), and the selected price were locked.`,"Customer",now);
        if ((p.work_plan?.tasks?.length || 0) > 1) await addEvent(db,created.id,"multi_task_plan_locked",`${p.work_plan!.tasks!.length} ordered tasks locked`,p.work_plan!.tasks!.map(task => `Task ${task.sequence}: ${task.title}`).join(" · "),"Doneeo",now);
        if (coordinatedSpecialists) await addEvent(db,created.id,"service_groups_coordinated","One customer order assigned across two internal services","Service A owns retailer pickup and delivery. Service B owns in-home installation, mounting and final box placement. Doneeo manages the handoff after Task 2.","Doneeo",now);
        await addEvent(db,created.id,"team_offered","Doneeo sent individual offers",`${matches.length} matched executor(s) received the same structured work order.`,"Doneeo",now);
      }
      return Response.json({ ok: true, reference: p.public_reference }, { status: 201 });
    }
    if (body.action === "assignment_status" && body.assignmentId && body.status) {
      const assignment = await db.prepare("SELECT a.work_order_id,a.executor_id,e.name FROM assignments a JOIN executors e ON e.id=a.executor_id WHERE a.id=?").bind(body.assignmentId).first<{ work_order_id: number; executor_id: string; name: string }>();
      await db.prepare("UPDATE assignments SET status=?, responded_at=? WHERE id=?").bind(body.status, now, body.assignmentId).run();
      if (assignment) {
        await addEvent(db,assignment.work_order_id,`executor_${body.status}`,`${assignment.name} ${body.status} the assignment`,body.status === "accepted" ? "This executor independently validated the role, route, schedule and payout." : "Doneeo will preserve the customer order and replace only this role.",assignment.name,now);
        const outstanding = await db.prepare("SELECT COUNT(*) AS count FROM assignments WHERE work_order_id=? AND status='offered'").bind(assignment.work_order_id).first<{ count: number }>();
        if (body.status === "accepted" && Number(outstanding?.count || 0) === 0) {
          await db.prepare("UPDATE work_orders SET status='equipment_check' WHERE id=?").bind(assignment.work_order_id).run();
          await addEvent(db,assignment.work_order_id,"team_confirmed","Every assigned executor has responded","Doneeo is now resolving only the equipment gaps that remain after profile equipment is applied.","Doneeo",now);
        } else if (body.status === "declined") await db.prepare("UPDATE work_orders SET status='rematching' WHERE id=?").bind(assignment.work_order_id).run();
      }
      return Response.json({ ok: true });
    }
    if (body.action === "work_order_status" && body.status && (body.workOrderId || body.reference)) {
      const allowed = ["matching", "team_pending", "equipment_check", "ready", "in_progress", "awaiting_customer", "completed", "rematching"];
      if (!allowed.includes(body.status)) return Response.json({ error: "Unsupported work-order status" }, { status: 400 });
      if (body.workOrderId) await db.prepare("UPDATE work_orders SET status=? WHERE id=?").bind(body.status, body.workOrderId).run();
      else await db.prepare("UPDATE work_orders SET status=? WHERE public_reference=?").bind(body.status, body.reference).run();
      const order = body.workOrderId ? { id: body.workOrderId } : await db.prepare("SELECT id FROM work_orders WHERE public_reference=?").bind(body.reference).first<{ id: number }>();
      if (order?.id) await addEvent(db,order.id,`status_${body.status}`,`Order moved to ${body.status.replaceAll("_", " ")}`,`The shared customer, executor and testing views now use the ${body.status} state.`,"Doneeo",now);
      return Response.json({ ok: true });
    }
    if (body.action === "replace_assignment" && body.workOrderId && body.executorId && body.replacementExecutorId) {
      await db.prepare("UPDATE assignments SET status='replaced', responded_at=? WHERE work_order_id=? AND executor_id=?").bind(now,body.workOrderId,body.executorId).run();
      await db.prepare("INSERT OR REPLACE INTO assignments (work_order_id,executor_id,role,is_lead,status,offered_at,responded_at) VALUES (?,?,?,0,'accepted',?,?)").bind(body.workOrderId,body.replacementExecutorId,"Handling support",now,now).run();
      await db.prepare("UPDATE work_orders SET status='equipment_check' WHERE id=?").bind(body.workOrderId).run();
      await addEvent(db,body.workOrderId,"replacement_matched","Replacement executor accepted","Only the declined role was replaced; the customer request, price and route were preserved.","Doneeo",now);
      return Response.json({ ok: true });
    }
    if (body.action === "equipment_response" && body.workOrderId && body.executorId && body.equipmentId && body.response) {
      await db.prepare("INSERT INTO equipment_responses (work_order_id,executor_id,equipment_id,profile_listed,response,responded_at) VALUES (?,?,?,?,?,?) ON CONFLICT(work_order_id,executor_id,equipment_id) DO UPDATE SET profile_listed=excluded.profile_listed,response=excluded.response,responded_at=excluded.responded_at")
        .bind(body.workOrderId,body.executorId,body.equipmentId,body.profileListed ? 1 : 0,body.response,now).run();
      await addEvent(db,body.workOrderId,"equipment_response",`${body.executorId} answered the equipment request`,`${body.equipmentId}: ${body.response.replaceAll("_", " ")}.`,body.executorId,now);
      return Response.json({ ok: true });
    }
    if (body.action === "reserve_rental" && body.workOrderId && body.equipmentId) {
      const existing = await db.prepare("SELECT id,unit_price FROM rental_reservations WHERE work_order_id=? AND equipment_id=? AND status='reserved'").bind(body.workOrderId,body.equipmentId).first<{ id: number; unit_price: number }>();
      if (existing) return Response.json({ ok: true, reservationId: existing.id, price: existing.unit_price });
      const item = await db.prepare("SELECT ri.partner_id,ri.daily_price FROM rental_inventory ri WHERE ri.equipment_id=? AND ri.quantity_available>0 ORDER BY ri.daily_price ASC LIMIT 1").bind(body.equipmentId).first<{ partner_id: string; daily_price: number }>();
      if (!item) return Response.json({ error: "No available rental inventory" }, { status: 409 });
      await db.prepare("INSERT INTO rental_reservations (work_order_id,partner_id,equipment_id,quantity,unit_price,status,pickup_by_executor_id,created_at) VALUES (?,?,?,?,?,'reserved',?,?)").bind(body.workOrderId,item.partner_id,body.equipmentId,1,item.daily_price,body.executorId || null,now).run();
      await db.prepare("UPDATE rental_inventory SET quantity_available=quantity_available-1 WHERE partner_id=? AND equipment_id=?").bind(item.partner_id,body.equipmentId).run();
      await addEvent(db,body.workOrderId,"rental_reserved","Rental gap resolved",`${body.equipmentId} was reserved from ${item.partner_id} for $${item.daily_price}. Pickup and return remain outside paid execution time.`,"Doneeo",now);
      return Response.json({ ok: true, partnerId: item.partner_id, price: item.daily_price }, { status: 201 });
    }
    if (body.action === "cancel_rental" && body.workOrderId && body.equipmentId) {
      const existing = await db.prepare("SELECT id,partner_id FROM rental_reservations WHERE work_order_id=? AND equipment_id=? AND status='reserved'").bind(body.workOrderId,body.equipmentId).first<{ id: number; partner_id: string }>();
      if (existing) {
        await db.batch([
          db.prepare("UPDATE rental_reservations SET status='cancelled' WHERE id=?").bind(existing.id),
          db.prepare("UPDATE rental_inventory SET quantity_available=quantity_available+1 WHERE partner_id=? AND equipment_id=?").bind(existing.partner_id,body.equipmentId),
        ]);
      }
      return Response.json({ ok: true });
    }
    if (body.action === "set_executor_status" && body.executorId && body.status) {
      if (!["available","busy","offline"].includes(body.status)) return Response.json({ error: "Unsupported executor status" }, { status: 400 });
      await db.prepare("UPDATE executors SET status=? WHERE id=?").bind(body.status,body.executorId).run();
      return Response.json({ ok: true });
    }
    if (body.action === "toggle_executor_equipment" && body.executorId && body.equipmentId) {
      const existing = await db.prepare("SELECT executor_id FROM executor_equipment WHERE executor_id=? AND equipment_id=?").bind(body.executorId,body.equipmentId).first();
      if (existing) await db.prepare("DELETE FROM executor_equipment WHERE executor_id=? AND equipment_id=?").bind(body.executorId,body.equipmentId).run();
      else await db.prepare("INSERT INTO executor_equipment (executor_id,equipment_id,quantity,verified) VALUES (?,?,1,1)").bind(body.executorId,body.equipmentId).run();
      return Response.json({ ok: true, equipped: !existing });
    }
    if (body.action === "reset_test_data") {
      await db.batch([
        db.prepare("DELETE FROM equipment_responses"),
        db.prepare("DELETE FROM rental_reservations"),
        db.prepare("DELETE FROM assignments"),
        db.prepare("DELETE FROM work_order_events"),
        db.prepare("DELETE FROM work_order_stops"),
        db.prepare("DELETE FROM work_orders"),
        db.prepare("DELETE FROM rental_inventory"),
      ]);
      await seedDatabase();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Database operation failed" }, { status: 500 });
  }
}

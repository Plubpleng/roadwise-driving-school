"use client";

import { useEffect, useState } from "react";
import { callRpc } from "../lib/supabase";

type View = "home" | "book" | "search" | "staff";
type ServiceKey = "practice" | "theory" | "renew";
type Booking = { code: string; name: string; phone: string; service: ServiceKey; date: string; slot: string; queue: number; status: "รอเรียกคิว" | "กำลังดำเนินการ" | "เสร็จสิ้น" };
type DbBooking = { booking_code: string; full_name: string; phone: string; service: ServiceKey; booking_date: string; time_slot: string; queue_number: number; status: Booking["status"] };

const toBooking = (row: DbBooking): Booking => ({ code: row.booking_code, name: row.full_name, phone: row.phone, service: row.service, date: row.booking_date, slot: row.time_slot, queue: row.queue_number, status: row.status });

const services: Record<ServiceKey, { title: string; short: string; detail: string; days: string; color: string }> = {
  practice: { title: "สมัครเรียนขับรถ", short: "ภาคปฏิบัติ", detail: "เรียนขับรถกับครูฝึกแบบตัวต่อตัว", days: "จันทร์ – เสาร์", color: "blue" },
  theory: { title: "อบรมใบขับขี่", short: "ภาคทฤษฎี", detail: "เรียนรู้กฎจราจรและเตรียมสอบใบขับขี่", days: "เฉพาะวันอาทิตย์", color: "navy" },
  renew: { title: "ต่อใบขับขี่", short: "บริการต่ออายุ", detail: "ตรวจเอกสารและดำเนินการต่อใบขับขี่", days: "เปิดทุกวัน", color: "sky" },
};
const slots = ["07:00 – 09:00", "09:00 – 11:00", "11:00 – 13:00", "13:00 – 15:00", "15:00 – 17:00"];
function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    user: <><circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    car: <><path d="m5 17-1-5 2-5h12l2 5-1 5"/><path d="M4 12h16M7 17v2M17 17v2"/><circle cx="7" cy="15" r="1"/><circle cx="17" cy="15" r="1"/></>,
    book: <><path d="M4 5a3 3 0 0 1 3-3h13v17H7a3 3 0 0 0-3 3z"/><path d="M4 5v17M8 6h8"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 20v-5h-5"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></>,
    shield: <><path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Logo() { return <div className="brand"><span className="brand-mark"><Icon name="car" size={23}/></span><span><b>ROADWISE</b><small>DRIVING SCHOOL</small></span></div>; }

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [service, setService] = useState<ServiceKey | null>(null);
  const [date, setDate] = useState("2026-09-14");
  const [slot, setSlot] = useState(slots[0]);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [booking, setBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [query, setQuery] = useState({ code: "", phone: "" });
  const [searched, setSearched] = useState<Booking | null>(null);
  const [staffService, setStaffService] = useState<ServiceKey>("practice");
  const [staffDate, setStaffDate] = useState("2026-09-14");

  useEffect(() => {
    if (view !== "staff") return;
    callRpc<DbBooking[]>("list_day_bookings", { p_service: staffService, p_booking_date: staffDate })
      .then((rows) => setBookings(rows.map(toBooking)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "โหลดข้อมูลคิวไม่สำเร็จ"));
  }, [view, staffService, staffDate]);

  const validDay = (key: ServiceKey, value: string) => { const day = new Date(`${value}T12:00:00`).getDay(); return key === "renew" || (key === "theory" ? day === 0 : day !== 0); };
  const dateLabel = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));

  function startBooking(key: ServiceKey) { setService(key); setDate(key === "theory" ? "2026-09-20" : "2026-09-14"); setView("book"); setBooking(null); setError(""); }
  async function confirmBooking() {
    if (!service || !form.name.trim() || form.phone.length < 9) return;
    setIsSubmitting(true); setError("");
    try {
      const row = await callRpc<DbBooking>("create_booking", { p_full_name: form.name, p_phone: form.phone, p_service: service, p_booking_date: date, p_time_slot: slot });
      setBooking(toBooking(row));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replace(/[{}\"]+/g, "") : "บันทึกการจองไม่สำเร็จ");
    } finally { setIsSubmitting(false); }
  }
  function downloadReceipt() {
    if (!booking) return;
    const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 1500; const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.fillStyle = "#f5f9ff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.fillStyle = "#082c63"; ctx.fillRect(0, 0, canvas.width, 260);
    ctx.fillStyle = "#fff"; ctx.font = "bold 48px Arial"; ctx.fillText("ROADWISE", 80, 110); ctx.font = "28px Arial"; ctx.fillText("DRIVING SCHOOL", 84, 155); ctx.font = "bold 44px Arial"; ctx.fillText("ใบยืนยันการจองคิว", 80, 225);
    ctx.fillStyle = "#082c63"; ctx.font = "bold 72px Arial"; ctx.fillText(booking.code, 80, 390); ctx.font = "28px Arial"; ctx.fillText("Booking Code", 83, 430);
    const rows = [["ชื่อผู้จอง", booking.name], ["เบอร์โทรศัพท์", booking.phone], ["บริการ", `${services[booking.service as ServiceKey].title} (${services[booking.service].short})`], ["วันที่", booking.date], ["ช่วงเวลา", booking.slot], ["เลขคิว", String(booking.queue)]];
    ctx.font = "28px Arial"; rows.forEach((r, i) => { const y = 540 + i * 115; ctx.fillStyle = "#6f829c"; ctx.fillText(r[0], 85, y); ctx.fillStyle = "#132d52"; ctx.font = "bold 32px Arial"; ctx.fillText(r[1], 85, y + 42); ctx.font = "28px Arial"; });
    ctx.fillStyle = "#0d7a68"; ctx.fillRect(80, 1260, 1040, 1); ctx.fillStyle = "#55708f"; ctx.font = "26px Arial"; ctx.fillText("กรุณานำใบยืนยันนี้แสดงต่อเจ้าหน้าที่ในวันที่นัดหมาย", 80, 1330); ctx.fillText("เปิดให้บริการตั้งแต่ 07:00 น. เป็นต้นไป", 80, 1380);
    const a = document.createElement("a"); a.download = `roadwise-${booking.code}.png`; a.href = canvas.toDataURL("image/png"); a.click();
  }

  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner"><Logo/><button className="home-link" onClick={() => setView("home")}>หน้าหลัก <Icon name="arrow" size={18}/></button></div></header>
    <main className="page-wrap">
      {view === "home" && <Home onBook={startBooking} onSearch={() => setView("search")} onStaff={() => setView("staff")} />}
      {view === "book" && <BookingFlow service={service} setService={setService} date={date} setDate={setDate} slot={slot} setSlot={setSlot} form={form} setForm={setForm} validDay={validDay} dateLabel={dateLabel} onBack={() => setView("home")} onConfirm={confirmBooking} booking={booking} onDownload={downloadReceipt} error={error} isSubmitting={isSubmitting} />}
      {view === "search" && <Search query={query} setQuery={setQuery} searched={searched} onSearch={async () => { try { const rows = await callRpc<DbBooking[]>("find_booking", { p_booking_code: query.code, p_phone: query.phone }); setSearched(rows[0] ? toBooking(rows[0]) : null); } catch { setSearched(null); } }} onBack={() => setView("home")} />}
      {view === "staff" && <Staff service={staffService} setService={setStaffService} date={staffDate} setDate={setStaffDate} bookings={bookings} onBack={() => setView("home")} error={error} />}
    </main>
    <footer><span>© 2026 Roadwise Driving School</span><span className="footer-status"><i/> ระบบพร้อมให้บริการ</span></footer>
  </div>;
}

function Home({ onBook, onSearch, onStaff }: { onBook: (s: ServiceKey) => void; onSearch: () => void; onStaff: () => void }) {
  return <>
    <section className="hero"><div className="hero-copy"><p className="eyebrow">ONLINE QUEUE SYSTEM</p><h1>จัดการคิวเรียนขับรถ<br/><em>ให้เป็นเรื่องง่าย</em></h1><p className="hero-text">เลือกบริการ วัน และช่วงเวลาที่สะดวก<br/>ระบบจะจัดเลขคิวให้คุณทันที</p><div className="hero-actions"><button className="primary" onClick={() => onBook("practice")}>จองคิว <Icon name="arrow" size={18}/></button><button className="text-button" onClick={onSearch}>ค้นหาการจอง <Icon name="search" size={18}/></button></div></div><div className="hero-visual"><div className="road-line"/><div className="sign-card"><span>คิววันนี้</span><strong>03</strong><small>กำลังรอเรียก</small></div><div className="hero-orb orb-one"/><div className="hero-orb orb-two"/></div></section>
    <section className="section-block"><div className="section-head"><div><h2>เลือกบริการที่ต้องการ</h2><p>ทุกบริการรับจำนวนจำกัด 10 คิวต่อวัน</p></div><span className="open-hours"><Icon name="calendar" size={17}/> เปิด 07:00 น. เป็นต้นไป</span></div><div className="service-grid">{Object.entries(services).map(([key, s]) => <button className="service-card" key={key} onClick={() => onBook(key as ServiceKey)}><span className={`service-icon ${s.color}`}><Icon name={key === "practice" ? "car" : key === "theory" ? "book" : "refresh"}/></span><span className="service-info"><b>{s.title}</b><small>{s.short} · {s.days}</small><span>{s.detail}</span></span><Icon name="arrow" size={20}/></button>)}</div></section>
    <section className="lower-grid"><div className="guide-panel"><div className="panel-title"><span className="number-badge">01</span><div><h3>จองคิวใน 3 ขั้นตอน</h3><p>สะดวก รวดเร็ว ไม่ต้องรอที่โรงเรียน</p></div></div><div className="steps"><div><strong>เลือกบริการ</strong><span>เลือกประเภทบริการที่ต้องการ</span></div><div><strong>เลือกวันและเวลา</strong><span>ดูคิวว่างแล้วเลือกช่วงเวลาที่สะดวก</span></div><div><strong>รับใบยืนยัน</strong><span>บันทึกภาพใบยืนยันไว้แสดงต่อเจ้าหน้าที่</span></div></div></div><button className="search-panel" onClick={onSearch}><span className="search-panel-icon"><Icon name="search" size={25}/></span><span><b>ค้นหาการจองคิว</b><small>ตรวจสอบข้อมูลและสถานะคิว<br/>ด้วย Booking Code และเบอร์โทรศัพท์</small></span><Icon name="arrow" size={20}/></button></section>
    <button className="staff-entry" onClick={onStaff}><Icon name="shield" size={16}/> สำหรับเจ้าหน้าที่</button>
  </>;
}

function BookingFlow({ service, setService, date, setDate, slot, setSlot, form, setForm, validDay, dateLabel, onBack, onConfirm, booking, onDownload, error, isSubmitting }: any) {
  return <section className="flow-wrap"><button className="back-link" onClick={onBack}>← กลับหน้าหลัก</button><div className="flow-heading"><div><p className="eyebrow">BOOK A QUEUE</p><h1>จองคิวของคุณ</h1><p>กรอกข้อมูลให้ครบ แล้วเราจะเตรียมคิวที่เหมาะกับคุณ</p></div><div className="stepper"><span className="active">1 <small>บริการ</small></span><i/><span className={service ? "active" : ""}>2 <small>วันและเวลา</small></span><i/><span className={booking ? "active" : ""}>3 <small>ยืนยัน</small></span></div></div>
    {!booking ? <div className="booking-layout"><div className="booking-main"><div className="form-section"><h3>เลือกบริการ</h3><div className="mini-service-grid">{Object.entries(services).map(([key, s]) => <button key={key} className={`mini-service ${service === key ? "selected" : ""}`} onClick={() => setService(key)}><span className={`service-icon ${s.color}`}><Icon name={key === "practice" ? "car" : key === "theory" ? "book" : "refresh"} size={19}/></span><span><b>{s.title}</b><small>{s.days}</small></span>{service === key && <Icon name="check" size={19}/>}</button>)}</div></div><div className="form-section"><h3>เลือกวันและช่วงเวลา</h3><div className="date-row"><label>วันที่นัดหมาย<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><div className="selected-date"><Icon name="calendar" size={18}/><span>{dateLabel}</span></div></div>{service && !validDay(service, date) && <p className="form-error">บริการนี้ไม่เปิดในวันที่เลือก กรุณาเลือกวันใหม่</p>}<div className="slot-grid">{slots.map((x, i) => <button key={x} className={slot === x ? "slot selected" : "slot"} onClick={() => setSlot(x)}><span>{x}</span><small>{[6, 7, 8, 5, 6][i]} คิวว่าง</small></button>)}</div></div><div className="form-section"><h3>ข้อมูลผู้จอง</h3><div className="input-grid"><label>ชื่อ – นามสกุล<input placeholder="เช่น สมชาย ใจดี" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}/></label><label>เบอร์โทรศัพท์<input inputMode="tel" placeholder="08X-XXX-XXXX" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value.replace(/[^0-9]/g, "")})}/></label></div></div>{error && <p className="form-error">{error}</p>}<button className="primary full" disabled={!service || !validDay(service, date) || !form.name || form.phone.length < 9 || isSubmitting} onClick={onConfirm}>{isSubmitting ? "กำลังบันทึก..." : "ยืนยันการจองคิว"} <Icon name="arrow" size={18}/></button></div><aside className="summary-card"><div className="summary-top"><span>สรุปการจอง</span><Icon name="check" size={20}/></div>{service ? <><h3>{services[service as ServiceKey].title}</h3><p>{services[service as ServiceKey].short}</p><hr/><div className="summary-row"><span>วันที่</span><b>{dateLabel}</b></div><div className="summary-row"><span>ช่วงเวลา</span><b>{slot}</b></div><div className="summary-note"><Icon name="shield" size={16}/> ข้อมูลของคุณจะถูกใช้เพื่อการจองคิวเท่านั้น</div></> : <div className="summary-empty"><Icon name="calendar" size={30}/><p>เลือกบริการเพื่อดู<br/>รายละเอียดการจอง</p></div>}</aside></div> : <Confirmation booking={booking} onDownload={onDownload} onHome={onBack} />}
  </section>;
}

function Confirmation({ booking, onDownload, onHome }: { booking: Booking; onDownload: () => void; onHome: () => void }) { return <div className="confirmation"><div className="success-icon"><Icon name="check" size={34}/></div><p className="eyebrow">BOOKING CONFIRMED</p><h2>จองคิวเรียบร้อยแล้ว</h2><p className="confirm-copy">บันทึกใบยืนยันนี้ไว้ และนำไปแสดงต่อเจ้าหน้าที่ในวันที่นัดหมาย</p><div className="receipt"><div className="receipt-head"><span>BOOKING CODE</span><strong>{booking.code}</strong></div><div className="receipt-grid"><div><small>ชื่อผู้จอง</small><b>{booking.name}</b></div><div><small>เบอร์โทรศัพท์</small><b>{booking.phone}</b></div><div><small>บริการ</small><b>{services[booking.service as ServiceKey].title}</b></div><div><small>วันที่ / เวลา</small><b>{booking.date} · {booking.slot}</b></div></div><div className="queue-number"><small>เลขคิวของคุณ</small><strong>{String(booking.queue).padStart(2, "0")}</strong></div></div><div className="confirmation-actions"><button className="primary" onClick={onDownload}><Icon name="download" size={18}/> ดาวน์โหลดใบยืนยัน</button><button className="secondary" onClick={onHome}>กลับหน้าหลัก</button></div></div>; }

function Search({ query, setQuery, searched, onSearch, onBack }: any) { return <section className="simple-page"><button className="back-link" onClick={onBack}>← กลับหน้าหลัก</button><div className="simple-heading"><p className="eyebrow">FIND YOUR BOOKING</p><h1>ค้นหาการจองคิว</h1><p>ใช้ Booking Code และเบอร์โทรศัพท์ที่กรอกตอนจอง</p></div><div className="search-box"><div className="input-grid"><label>Booking Code<input placeholder="เช่น RDS-7K2M9P" value={query.code} onChange={(e: any) => setQuery({...query, code: e.target.value.toUpperCase()})}/></label><label>เบอร์โทรศัพท์<input placeholder="08X-XXX-XXXX" value={query.phone} onChange={(e: any) => setQuery({...query, phone: e.target.value.replace(/[^0-9]/g, "")})}/></label></div><button className="primary full" onClick={onSearch}>ค้นหาการจอง <Icon name="search" size={18}/></button></div>{searched ? <div className="search-result"><div><span className="status-chip"><i/> {searched.status}</span><h3>{services[searched.service as ServiceKey].title}</h3><p>{searched.name} · {searched.phone}</p></div><strong className="result-queue">คิว {String(searched.queue).padStart(2, "0")}</strong><div className="result-meta"><span><Icon name="calendar" size={16}/> {searched.date}</span><span>ช่วงเวลา {searched.slot}</span><span>Code {searched.code}</span></div></div> : query.code && <p className="not-found">ไม่พบข้อมูลการจอง กรุณาตรวจสอบ Booking Code และเบอร์โทรศัพท์อีกครั้ง</p>}</section>; }

function Staff({ service, setService, date, setDate, bookings, onBack }: any) { return <section className="staff-page"><button className="back-link" onClick={onBack}>← กลับหน้าหลัก</button><div className="staff-heading"><div><p className="eyebrow">STAFF CONSOLE</p><h1>จัดการคิววันนี้</h1><p>ตรวจสอบรายชื่อผู้จองและสถานะคิวแยกตามบริการ</p></div><span className="staff-live"><i/> LIVE</span></div><div className="staff-filters"><label>บริการ<select value={service} onChange={(e) => setService(e.target.value)}>{Object.entries(services).map(([key, s]) => <option key={key} value={key}>{s.title}</option>)}</select></label><label>วันที่<input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label><div className="capacity"><b>{bookings.length}<small>/ 10</small></b><span>คิวที่จองแล้ว</span></div></div><div className="staff-table"><div className="table-head"><span>คิว</span><span>ผู้จอง</span><span>ช่วงเวลา</span><span>สถานะ</span></div>{bookings.length ? bookings.map((b: Booking) => <div className="table-row" key={b.code}><strong>{String(b.queue).padStart(2, "0")}</strong><span><b>{b.name}</b><small>{b.phone}</small></span><span>{b.slot}</span><span className={`status-text ${b.status === "กำลังดำเนินการ" ? "doing" : ""}`}><i/> {b.status}</span></div>) : <div className="table-empty">ยังไม่มีรายการจองในวันนี้</div>}</div></section>; }






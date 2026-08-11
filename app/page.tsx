"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Member = {
  id: number;
  name: string;
  relation: string;
  generation: number;
  color: string;
  gender?: "son" | "daughter";
  spouseName?: string;
  parentId?: number;
  nickname?: string;
  dateOfBirth?: string;
};

const starterMembers: Member[] = [
  { id: 1, name: "Arthur", nickname: "Dadaji", dateOfBirth: "1942-03-12", relation: "Family founder", generation: 0, color: "clay", spouseName: "Evelyn" },
  { id: 3, name: "James", nickname: "Jay", dateOfBirth: "1968-06-18", relation: "Their son", generation: 1, color: "amber", parentId: 1 },
  { id: 4, name: "Maya", dateOfBirth: "1972-09-04", relation: "Their daughter", generation: 1, color: "sage", parentId: 1 },
  { id: 5, name: "Noah", dateOfBirth: "1994-01-23", relation: "Grandson · James's branch", generation: 2, color: "sky", parentId: 3 },
  { id: 6, name: "Lily", nickname: "Lilu", dateOfBirth: "1998-07-11", relation: "Granddaughter · James's branch", generation: 2, color: "rose", parentId: 3 },
  { id: 7, name: "Sofia", dateOfBirth: "2000-02-15", relation: "Granddaughter · Maya's branch", generation: 2, color: "sage", parentId: 4 },
  { id: 8, name: "Leo", dateOfBirth: "2004-11-08", relation: "Grandson · Maya's branch", generation: 2, color: "amber", parentId: 4 },
];

const colors = ["clay", "rose", "amber", "sage", "sky"];

function IllustratedBranches({ members }: { members: Member[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tree = canvas.parentElement;
    if (!tree) return;

    const draw = () => {
      const rect = tree.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const point = (id: number) => {
        const element = tree.querySelector<HTMLElement>(`[data-member-id="${id}"]`);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.left - rect.left + box.width / 2, top: box.top - rect.top, bottom: box.bottom - rect.top };
      };
      const founders = members.filter((member) => member.generation === 0).map((member) => point(member.id)).filter(Boolean) as {x:number;top:number;bottom:number}[];
      const rootX = founders.length ? founders.reduce((sum, item) => sum + item.x, 0) / founders.length : rect.width / 2;
      const rootY = founders.length ? Math.max(...founders.map((item) => item.bottom)) : rect.height * .78;

      const branch = (fromX: number, fromY: number, toX: number, toY: number, width: number) => {
        const gradient = ctx.createLinearGradient(fromX, fromY, toX, toY);
        gradient.addColorStop(0, "#51351f"); gradient.addColorStop(.48, "#795033"); gradient.addColorStop(1, "#49301e");
        ctx.strokeStyle = gradient; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(fromX, fromY);
        const middle = (fromY + toY) / 2;
        ctx.bezierCurveTo(fromX, middle, toX, middle, toX, toY); ctx.stroke();
        ctx.strokeStyle = "#b8835148"; ctx.lineWidth = Math.max(1, width * .12);
        ctx.beginPath(); ctx.moveTo(fromX - width * .12, fromY); ctx.bezierCurveTo(fromX, middle, toX, middle, toX - width * .08, toY); ctx.stroke();
      };

      branch(rect.width / 2, rect.height - 8, rootX, rootY - 24, 42);
      for (let i = 0; i < 5; i++) branch(rect.width / 2, rect.height - 14, rect.width / 2 + (i - 2) * 58, rect.height - 2, 5);
      if (founders.length > 1) branch(founders[0].x, founders[0].top + 54, founders[1].x, founders[1].top + 54, 8);

      members.forEach((member) => {
        if (!member.parentId) return;
        const parent = point(member.parentId); const child = point(member.id);
        if (parent && child) branch(parent.x, parent.top + 15, child.x, child.bottom - 12, member.generation === 1 ? 24 : 13);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(tree);
    return () => observer.disconnect();
  }, [members]);

  return <canvas ref={canvasRef} className="branch-canvas" aria-hidden="true" />;
}

export default function Home() {
  const [members, setMembers] = useState<Member[]>(starterMembers);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [addMarried, setAddMarried] = useState(false);
  const [addParentChoice, setAddParentChoice] = useState("");

  useEffect(() => {
    const version = window.localStorage.getItem("kinfolk-layout-version");
    const saved = window.localStorage.getItem("kinfolk-members");
    if (saved && version === "6") setMembers(JSON.parse(saved));
    else {
      window.localStorage.setItem("kinfolk-members", JSON.stringify(starterMembers));
      window.localStorage.setItem("kinfolk-layout-version", "6");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("kinfolk-members", JSON.stringify(members));
  }, [members]);

  const generations = useMemo(
    () => {
      const highest = Math.max(0, ...members.map((member) => member.generation));
      return Array.from({ length: highest + 1 }, (_, index) => highest - index)
        .map((generation) => members
          .filter((member) => member.generation === generation)
          .sort((a, b) => (a.dateOfBirth || "9999").localeCompare(b.dateOfBirth || "9999")));
    },
    [members],
  );

  function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) return;
    const parentChoice = String(data.get("parentId") || "");
    const isNewRoot = parentChoice === "new-root";
    const parentId = isNewRoot ? undefined : Number(parentChoice) || undefined;
    const parent = members.find((member) => member.id === parentId);
    const generation = parent ? parent.generation + 1 : 0;
    const gender = String(data.get("gender") || "son") as "son" | "daughter";
    const spouseName = addMarried ? String(data.get("spouseName") || "").trim() : "";
    const id = Date.now();
    const newMember: Member = {
        id,
        name,
        relation: isNewRoot ? "Earliest family ancestor" : parent ? `${gender === "daughter" ? "Daughter" : "Son"} of ${parent.name}` : "Family founder",
        generation,
        color: colors[members.length % colors.length],
        gender,
        spouseName,
        parentId,
        nickname: String(data.get("nickname") || "").trim(),
        dateOfBirth: String(data.get("dateOfBirth") || ""),
      };
    setMembers((current) => {
      if (!isNewRoot) return [...current, newMember];
      return [
        ...current.map((member) => ({
          ...member,
          generation: member.generation + 1,
          parentId: member.generation === 0 ? id : member.parentId,
        })),
        newMember,
      ];
    });
    event.currentTarget.reset();
    setAddMarried(false);
    setAddParentChoice("");
    setShowForm(false);
  }

  function editMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const updated = { ...editing, name: String(data.get("name") || "").trim(), nickname: String(data.get("nickname") || "").trim(), dateOfBirth: String(data.get("dateOfBirth") || ""), relation: String(data.get("relation") || "").trim(), generation: Number(data.get("generation")) };
    if (!updated.name || !updated.relation) return;
    setMembers((current) => current.map((member) => member.id === updated.id ? updated : member));
    setSelected(updated);
    setEditing(null);
  }

  function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from the family tree?`)) return;
    setMembers((current) => current.filter((item) => item.id !== member.id));
    setSelected(null);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#tree" aria-label="Kinfolk family tree home">
          <span className="brand-mark">K</span>
          <span>Kinfolk</span>
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#tree">Family Tree</a>
          <a href="#stories">Stories</a>
          <a href="#gallery">Gallery</a>
        </nav>
        <button className="add-button" onClick={() => setShowForm(true)}>
          <span>＋</span> Add member
        </button>
      </header>

      <section className="intro">
        <p className="eyebrow">OUR FAMILY, THROUGH THE GENERATIONS</p>
        <h1>Where every branch<br />tells a story.</h1>
        <p className="subcopy">Explore the people, moments, and connections that have shaped who we are.</p>
      </section>

      <section className="tree-stage" id="tree" aria-label="Interactive family tree" style={{ "--generation-count": generations.length } as React.CSSProperties}>
        <div className="sun-glow" />
        <div className="tree-crown">
          <IllustratedBranches members={members} />
          {generations.map((generation, row) => (
            <div className="generation" key={row} style={{ "--row": row } as React.CSSProperties}>
              {generation.map((member, index) => (
                <button
                  className={`member-leaf ${member.color}`}
                  key={member.id}
                  data-member-id={member.id}
                  style={{ "--delay": `${index * 80}ms` } as React.CSSProperties}
                  onClick={() => setSelected(member)}
                  aria-label={`View ${member.name}, ${member.relation}`}
                >
                  <span className="leaf-face">
                    <span className="portrait">{member.name.slice(0, 1)}</span>
                    <span className="member-name">{member.name}</span>
                    {member.nickname && <span className="nickname">“{member.nickname}”</span>}
                    {member.spouseName && <span className="spouse-name">&amp; {member.spouseName}</span>}
                    <span className="relation">{member.relation}</span>
                  </span>
                </button>
              ))}
            </div>
          ))}
          <div className="branch branch-left" />
          <div className="branch branch-right" />
          <div className="branch branch-upper-left" />
          <div className="branch branch-upper-right" />
          <div className="family-line line-root" />
          <div className="family-line line-parents" />
          <div className="family-line line-father" />
          <div className="family-line line-mother" />
          <div className="family-line line-grandparents" />
        </div>
        <div className="trunk"><span className="heart">♡</span></div>
        <div className="ground-shadow" />
        <p className="tree-caption"><strong>{members.length} people</strong><span />{generations.length} generations<span />1 beautiful story</p>
      </section>

      <section className="story-strip" id="stories">
        <p>“Family is not an important thing. It’s everything.”</p>
        <span>— Michael J. Fox</span>
      </section>

      {showForm && (
        <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="add-title">
            <button className="close" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            <p className="eyebrow">A NEW LEAF</p>
            <h2 id="add-title">Add a family member</h2>
            <p>Choose whose child they are. Their spouse stays on this leaf—no in-law family details are requested.</p>
            <form onSubmit={addMember}>
              <label>Name<input name="name" placeholder="e.g. Sofia" required autoFocus /></label>
              <label>Nickname <span className="optional">(optional)</span><input name="nickname" placeholder="e.g. Sonu" /></label>
              <label>Date of birth<input name="dateOfBirth" type="date" required /></label>
              <label>This person is a
                <select name="gender" defaultValue="son">
                  <option value="son">Son</option>
                  <option value="daughter">Daughter</option>
                </select>
              </label>
              <label>Where does this person belong?
                <select
                  name="parentId"
                  value={addParentChoice}
                  onChange={(event) => {
                    const value = event.target.value;
                    setAddParentChoice(value);
                    if (value === "new-root") setAddMarried(true);
                  }}
                >
                  <option value="">Start a separate family</option>
                  {members.length > 0 && <option value="new-root">New earliest ancestor — move everyone upward</option>}
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>Child of {member.name}{member.spouseName ? ` & ${member.spouseName}` : ""}</option>
                  ))}
                </select>
              </label>
              <label>Married?
                <select
                  value={addMarried ? "yes" : "no"}
                  disabled={addParentChoice === "new-root"}
                  onChange={(event) => setAddMarried(event.target.value === "yes")}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                {addParentChoice === "new-root" && <span className="field-note">An earliest ancestor is entered with their spouse as the founding couple.</span>}
              </label>
              {addMarried && <label>Spouse’s name<input name="spouseName" placeholder="e.g. Daniel" required /></label>}
              <button className="submit" type="submit">Grow a new leaf</button>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-title">
            <button className="close" onClick={() => setEditing(null)} aria-label="Close">×</button>
            <p className="eyebrow">UPDATE THIS LEAF</p>
            <h2 id="edit-title">Edit {editing.name}</h2>
            <p>Change their details or move them to another generation.</p>
            <form onSubmit={editMember}>
              <label>Name<input name="name" defaultValue={editing.name} required autoFocus /></label>
              <label>Nickname <span className="optional">(optional)</span><input name="nickname" defaultValue={editing.nickname || ""} /></label>
              <label>Date of birth<input name="dateOfBirth" type="date" defaultValue={editing.dateOfBirth || ""} required /></label>
              <label>Relationship<input name="relation" defaultValue={editing.relation} required /></label>
              <label>Generation
                <select name="generation" defaultValue={editing.generation}>
                  <option value="0">Founding couple</option>
                  <option value="1">Their children</option>
                  <option value="2">Grandchildren</option>
                </select>
              </label>
              <button className="submit" type="submit">Save changes</button>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="profile-card">
          <button className="profile-close" onClick={() => setSelected(null)} aria-label="Close profile">×</button>
          <span className={`profile-portrait ${selected.color}`}>{selected.name[0]}</span>
          <div className="profile-details">
            <strong>{selected.name}{selected.nickname ? ` “${selected.nickname}”` : ""}{selected.spouseName ? ` & ${selected.spouseName}` : ""}</strong><small>{selected.relation}</small>
            <div className="profile-actions">
              <button onClick={() => setEditing(selected)}>Edit</button>
              <button className="delete-action" onClick={() => deleteMember(selected)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

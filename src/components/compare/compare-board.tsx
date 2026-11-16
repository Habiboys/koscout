import Link from "next/link";
import { SourceBadge } from "@/components/listings/source-badge";

export type CompareColumn = {
  id: string;
  name: string;
  imageUrl: string | null;
  sourceName: string;
  sourceUrl: string | null;
  badges: string[];
  price: string;
  priceHint: string | null;
  priceBest: boolean;
  distance: string;
  distanceHint: string;
  distanceBest: boolean;
  duration: string;
  durationBest: boolean;
  gender: string;
  size: string;
  electricity: string;
  rating: string | null;
  rooms: string | null;
  monthly: string;
  monthlyHint: string | null;
  monthlyBest: boolean;
  perM2: string;
  facilities: string[];
  note: string | null;
  score: string;
  scoreBest: boolean;
  completeness: string;
};

export function CompareBoard({ columns }: { columns: CompareColumn[] }) {
  const showRating = columns.some((column) => column.rating);
  const showRooms = columns.some((column) => column.rooms);
  const showNotes = columns.some((column) => column.note);

  return (
    <div className="compare-scroll">
      <div
        className="compare-grid"
        style={{ gridTemplateColumns: `9.4rem repeat(${columns.length}, minmax(13rem, 1fr))` }}
      >
        <div className="compare-label compare-corner">Kos</div>
        {columns.map((column) => (
          <div key={column.id} className="compare-head">
            {column.imageUrl ? (
              <img className="compare-photo" src={column.imageUrl} alt="" />
            ) : (
              <div className="compare-photo compare-photo--empty">{column.name.slice(0, 1)}</div>
            )}
            <div className="compare-head-body">
              <Link className="compare-name" href={`/listings/${column.id}`}>
                {column.name}
              </Link>
              {column.badges.length > 0 ? (
                <div className="compare-badges">
                  {column.badges.map((badge) => (
                    <span key={badge} className="badge clay">
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              <Link className="compare-open" href={`/listings/${column.id}`}>
                Lihat detail
              </Link>
            </div>
          </div>
        ))}

        <div className="compare-section">Yang paling menentukan</div>
        <Row label="Harga sewa">
          {columns.map((column) => (
            <Cell key={column.id} best={column.priceBest}>
              <strong className="compare-figure">{column.price}</strong>
              {column.priceHint ? <span className="compare-hint">{column.priceHint}</span> : null}
            </Cell>
          ))}
        </Row>
        <Row label="Jarak ke kantor">
          {columns.map((column) => (
            <Cell key={column.id} best={column.distanceBest}>
              <strong className="compare-figure">{column.distance}</strong>
              <span className="compare-hint">{column.distanceHint}</span>
            </Cell>
          ))}
        </Row>
        <Row label="Waktu tempuh">
          {columns.map((column) => (
            <Cell key={column.id} best={column.durationBest}>
              <strong className="compare-figure">{column.duration}</strong>
            </Cell>
          ))}
        </Row>

        <div className="compare-section">Kamar</div>
        <Row label="Jenis">
          {columns.map((column) => (
            <Cell key={column.id}>{column.gender}</Cell>
          ))}
        </Row>
        <Row label="Ukuran">
          {columns.map((column) => (
            <Cell key={column.id}>{column.size}</Cell>
          ))}
        </Row>
        <Row label="Listrik">
          {columns.map((column) => (
            <Cell key={column.id}>{column.electricity}</Cell>
          ))}
        </Row>
        {showRating ? (
          <Row label="Rating">
            {columns.map((column) => (
              <Cell key={column.id}>{column.rating ?? "Belum ada"}</Cell>
            ))}
          </Row>
        ) : null}
        {showRooms ? (
          <Row label="Kamar kosong">
            {columns.map((column) => (
              <Cell key={column.id}>{column.rooms ?? "Belum diketahui"}</Cell>
            ))}
          </Row>
        ) : null}
        <Row label="Fasilitas">
          {columns.map((column) => (
            <Cell key={column.id}>
              {column.facilities.length > 0 ? (
                <div className="compare-chips">
                  {column.facilities.map((item) => (
                    <span key={item} className="compare-chip">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                "Belum diketahui"
              )}
            </Cell>
          ))}
        </Row>
        {showNotes ? (
          <Row label="Catatan">
            {columns.map((column) => (
              <Cell key={column.id}>
                <span className="compare-note">{column.note ?? "—"}</span>
              </Cell>
            ))}
          </Row>
        ) : null}

        <div className="compare-section">Biaya</div>
        <Row label="Total per bulan">
          {columns.map((column) => (
            <Cell key={column.id} best={column.monthlyBest}>
              <strong className="compare-figure">{column.monthly}</strong>
              {column.monthlyHint ? <span className="compare-hint">{column.monthlyHint}</span> : null}
            </Cell>
          ))}
        </Row>
        <Row label="Harga / m²">
          {columns.map((column) => (
            <Cell key={column.id}>{column.perM2}</Cell>
          ))}
        </Row>

        <div className="compare-section">Seberapa lengkap datanya</div>
        <Row label="Skor">
          {columns.map((column) => (
            <Cell key={column.id} best={column.scoreBest}>
              <strong className="compare-figure">{column.score}</strong>
            </Cell>
          ))}
        </Row>
        <Row label="Kelengkapan">
          {columns.map((column) => (
            <Cell key={column.id}>{column.completeness}</Cell>
          ))}
        </Row>
        <Row label="Sumber">
          {columns.map((column) => (
            <Cell key={column.id}>
              <SourceBadge sourceName={column.sourceName} sourceUrl={column.sourceUrl} />
            </Cell>
          ))}
        </Row>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="compare-label">{label}</div>
      {children}
    </>
  );
}

function Cell({ best, children }: { best?: boolean; children: React.ReactNode }) {
  return <div className={best ? "compare-cell compare-best" : "compare-cell"}>{children}</div>;
}

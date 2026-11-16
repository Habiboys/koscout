import { describe, expect, it } from "vitest";
import { parseMamikosCard, readMamikosRoom } from "@/server/import/parse-mamikos";

describe("parseMamikosCard", () => {
  it("reads a room card captured from the open page", () => {
    const card = parseMamikosCard({
      href: "https://mamikos.com/room/kost-mansion-nine-tipe-b",
      text: "Campur Kost Mansion Nine Tipe B Cidadap Rp1.645.000 (Bulan pertama)",
      images: ["https://static.mamikos.com/uploads/cache/data/style/depan.jpg"],
      html: `
        <span class="rc-info__name bg-c-text"> Kost Mansion Nine Tipe B </span>
        <span class="rc-info__location bg-c-text"> Cidadap </span>
        <span data-testid="kostListPriceReal"> Rp1.645.000 </span>
      `,
    });
    expect(card).toMatchObject({
      name: "Kost Mansion Nine Tipe B",
      area: "Cidadap",
      gender: "campur",
      priceAmount: 1_645_000,
      sourceUrl: "https://mamikos.com/room/kost-mansion-nine-tipe-b",
      note: "Harga di kartu adalah bulan pertama.",
    });
  });

  it("reads the room detail page coordinates, size, and facilities", () => {
    const room = readMamikosRoom(`
      <p class="detail-title__room-name"> Kost Pondok Teratai Unpar Tipe E Cidadap Bandung </p>
      <span class="detail-kost-overview__gender-box"> Kos Campur </span>
      <p class="detail-kost-overview__area-text">Cidadap</p>
      <span data-testid="kostDetailPriceReal"> Rp1.500.000 </span>
      <p class="detail-kost-facility-item__label"> 3 x 4 meter </p>
      <p class="detail-kost-facility-item__label"> Termasuk listrik </p>
      <div data-testid="kost-facility-note-description">CCTV, Free Wifi, akses 24 jam</div>
      <div data-testid="kost-owner-story-content">Dekat UNPAR 3 menit jalan kaki.</div>
      <script>var detail = {"room_title":"Kost Pondok Teratai Unpar Tipe E","slug":"pondok-teratai","latitude":-6.876251,"longitude":107.606102,"available_room":2,"fac_bath_icon":[{"name":"K. Mandi Dalam"}],"fac_park_icon":[{"name":"Parkir Motor"}],"fac_share_icon":[{"name":"Dapur"}]}; detail.type = 'kost';</script>
    `);
    expect(room).toMatchObject({
      name: "Kost Pondok Teratai Unpar Tipe E",
      sourceUrl: "https://mamikos.com/room/pondok-teratai",
      latitude: -6.876251,
      longitude: 107.606102,
      priceAmount: 1_500_000,
      roomSizeM2: 12,
      electricityStatus: "included",
      facilities: ["wifi", "private_bathroom", "motorcycle_parking", "kitchen"],
    });
  });

  it("reads rating, refund, rules, and nearby places from the detail page", () => {
    const room = readMamikosRoom(`
      <p class="detail-title__room-name"> Kost Pondok Bersama 2 Tipe A Cidadap Bandung </p>
      <span class="detail-kost-overview__gender-box"> Kos Putra </span>
      <p class="detail-kost-overview__rating-text">3.5</p>
      <p class="detail-kost-overview__rating-review">(2)</p>
      <p class="detail-kost-overview__total-transaction-text">6 transaksi berhasil di kos ini</p>
      <p class="detail-kost-overview__availability-text">Tersisa <span class="detail-kost-overview__availability-text--danger">3 kamar</span></p>
      <div class="detail-kost-owner-section__owner-title"> Kos disewakan oleh Imas Siti Robiah </div>
      <p class="detail-kost-refund__description"> Kos bisa refund sesuai ketentuan. </p>
      <section class="detail-kost-special-rules">
        <p class="detail-kost-rule-item__label"> Maks. 1 orang/kamar </p>
        <p class="detail-kost-rule-item__label"> Tambah biaya untuk alat elektronik </p>
        <p class="detail-kost-rule-item__description"> Agar pemilik dapat menghitung biayanya. </p>
      </section>
      <div data-testid="kost-owner-story-content">Kos untuk Putra 2 kt<br>di atas ada 5 kamar</div>
      <div data-testid="landmark-item">
        <p class="landmark-item__text-ellipsis"> Universitas Pendidikan Indonesia </p>
        <p class="landmark-item__landmark-distance"> 545 m </p>
      </div>
      <div class="users-feedback-container users-feedback-container--card">
        <div class="users-feedback__section">
          <p class="user-feedback__profile-name">Anonim</p>
          <p class="bg-c-text--label-2">3 tahun yang lalu</p>
          <div class="user-feedback__rating"><p class="bg-c-text--body-1">2.5</p></div>
          <p class="user-feedback__content-text">parkiran sempit</p>
        </div>
      </div>
      <script>var detail = {"room_title":"Kost Pondok Bersama 2","slug":"pondok-bersama","latitude":-6.86,"longitude":107.59,"owner_header":"Pemilik Kos","gender":1}; detail.type = 'kost';</script>
    `);
    expect(room?.detailMeta).toMatchObject({
      overviewCaptured: true,
      rating: 3.5,
      reviewCount: 2,
      transactionLabel: "6 transaksi berhasil di kos ini",
      availableRoomsCount: 3,
      ownerName: "Kos disewakan oleh Imas Siti Robiah",
      refundNote: "Kos bisa refund sesuai ketentuan.",
      ownerStory: "Kos untuk Putra 2 kt\ndi atas ada 5 kamar",
    });
    expect(room?.detailMeta.rules).toEqual([
      "Maks. 1 orang/kamar",
      "Tambah biaya untuk alat elektronik. Agar pemilik dapat menghitung biayanya.",
    ]);
    expect(room?.detailMeta.nearbyPois).toEqual(["Universitas Pendidikan Indonesia · 545 m"]);
    expect(room?.detailMeta.reviews?.[0]).toMatchObject({ author: "Anonim", rating: 2.5, text: "parkiran sempit" });
  });

  it("reads rating, owner, and reviews from the Mamikos JSON payload", () => {
    const room = readMamikosRoom(
      `<script>var detail = {"room_title":"Kost Uji","slug":"uji","latitude":-6.8,"longitude":107.6,"rating":3.5,"review_count":2,"transaction_count":6,"owner_header":"Pemilik Kos","owner_name":"Imas Siti Robiah","gender":1,"html_description":"Baris satu<br>baris dua","booking_rules":{"is_married":false,"is_bring_child":false}}; detail.type = 'kost';</script>`,
      null,
      {
        reviews: [{ name: "Anonim", rating: "2.5", content: "parkiran sempit", tanggal: "28 Jan 2023" }],
        all_rating: { clean: 3.5, safe: 4.5 },
      },
    );
    expect(room?.detailMeta).toMatchObject({
      rating: 3.5,
      reviewCount: 2,
      transactionLabel: "6 transaksi berhasil di kos ini",
      ownerName: "Kos disewakan oleh Imas Siti Robiah",
      ownerStory: "Baris satu\nbaris dua",
    });
    expect(room?.detailMeta.rules).toEqual(expect.arrayContaining(["Tidak untuk pasutri", "Tidak boleh bawa anak"]));
    expect(room?.detailMeta.reviews?.[0]).toMatchObject({ author: "Anonim", rating: 2.5, text: "parkiran sempit" });
    expect(room?.detailMeta.ratingParts).toEqual([
      { label: "Kebersihan", score: 3.5 },
      { label: "Keamanan", score: 4.5 },
    ]);
  });
});

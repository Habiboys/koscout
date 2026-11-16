export type QuestionListing = {
  name: string;
  priceAmount: number | null;
  electricityStatus: string;
  internetStatus: string;
  depositAmount: number | null;
  roomSizeM2: number | null;
  availability: string;
  gender: string;
};

export function whatsappMessage(listing: QuestionListing): string {
  const questions: string[] = [];
  if (listing.priceAmount == null) questions.push("Berapa harga sewa per bulan saat ini?");
  if (listing.electricityStatus === "unknown") questions.push("Apakah listrik sudah termasuk?");
  if (listing.internetStatus === "unknown") questions.push("Apakah Wi-Fi sudah termasuk?");
  if (listing.depositAmount == null) questions.push("Berapa deposit dan biaya administrasi?");
  if (listing.roomSizeM2 == null) questions.push("Berapa luas kamar?");
  if (listing.availability === "unknown") questions.push("Apakah kamar masih tersedia?");
  if (listing.gender === "unknown") questions.push("Kos ini untuk putra, putri, atau campur?");
  questions.push("Apakah ada minimal sewa dan aturan jam malam?");
  const intro = `Halo, saya tertarik dengan ${listing.name}.`;
  return `${intro}\n${questions.map((item) => `- ${item}`).join("\n")}`;
}

export function streetViewUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${latitude},${longitude}`;
}

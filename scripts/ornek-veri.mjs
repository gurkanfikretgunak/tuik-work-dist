// Örnek (uydurma) veri üretir: public/ornek/calisanlar.csv ve isler.csv
import { writeFileSync } from "node:fs";
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];

const ad = ["Ayşe","Mehmet","Zeynep","Ali","Fatma","Mustafa","Elif","Hasan","Merve","Emre","Büşra","Can","Selin","Burak","Derya","Kemal"];
const soyad = ["Demir","Kaya","Arslan","Yıldız","Çelik","Şahin","Aydın","Öztürk","Koç","Polat"];
const yer = {
  Ankara: { Çankaya: ["Kızılay","Bahçelievler","Çayyolu"], Polatlı: ["Yenidoğan","Zafer"] },
  İzmir: { Karşıyaka: ["Bostanlı","Mavişehir"], Bornova: ["Kazımdirik","Evka-3"] },
  Konya: { Ereğli: ["Akpınar","Şehitler"], Selçuklu: ["Bosna","Yazır"] },
};
const emps = ["calisan_id,ad_soyad,rol,il,ilce,donemlik_kapasite,musait_oran,kir_gorevi_yapabilir,aktif,kapasite_notu"];
let n = 1;
const staff = [];
for (const [il, ilceler] of Object.entries(yer)) {
  for (let k = 0; k < 4; k++) {
    const ilce = pick(Object.keys(ilceler));
    const id = `C-${String(n++).padStart(3, "0")}`;
    const cap = pick([20, 25, 30]);
    const av = n % 7 === 0 ? 50 : 100;
    const kir = rnd() > 0.5 ? "Evet" : "Hayır";
    const aktif = n === 11 ? "Hayır" : "Evet";
    emps.push([id, `${pick(ad)} ${pick(soyad)}`, "Anketör", il, ilce, cap, av, kir, aktif, av === 50 ? "Yarı zamanlı" : cap === 30 ? "Deneyimli" : ""].join(","));
    staff.push(id);
  }
}
writeFileSync("public/ornek/calisanlar.csv", "﻿" + emps.join("\n") + "\n");

const jobs = ["is_id,il,ilce,mahalle,yerlesim_tipi,birim_no,gorusme_sayisi,onceki_ay_gorusen_calisan_id,oncelik,anket_turu"];
for (let i = 1; i <= 160; i++) {
  const il = pick(Object.keys(yer));
  const ilce = pick(Object.keys(yer[il]));
  const mah = pick(yer[il][ilce]);
  const kir = ["Polatlı", "Ereğli"].includes(ilce) && rnd() > 0.3 ? "Kır" : "Kent";
  const prev = rnd() > 0.6 ? pick(staff) : "";
  jobs.push([`IS-${String(i).padStart(4, "0")}`, il, ilce, mah, kir, `HN-${100000 + i * 7}`, pick([1, 1, 2, 2, 3]), prev, pick(["Normal", "Normal", "Normal", "Yüksek", "Düşük"]), pick(["Hanehalkı İşgücü", "Hanehalkı Bütçe"])].join(","));
}
// bilerek hatalı satırlar (doğrulama demosu)
jobs.push("IS-0161,Ankara,Çankaya,Kızılay,Bilinmez,HN-999001,2,,Normal,Hanehalkı İşgücü");
jobs.push("IS-0162,Ankara,Çankaya,,Kent,HN-999002,abc,,Normal,Hanehalkı İşgücü");
jobs.push("IS-0163,Van,Merkez,Cumhuriyet,Kent,HN-999003,2,,Normal,Hanehalkı İşgücü");
jobs.push("IS-0001,Ankara,Çankaya,Kızılay,Kent,HN-999004,1,,Normal,Hanehalkı İşgücü");
writeFileSync("public/ornek/isler.csv", "﻿" + jobs.join("\n") + "\n");
console.log("tamam");

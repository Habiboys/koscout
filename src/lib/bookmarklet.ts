export function bookmarkletHref(origin: string): string {
  const script = `javascript:(function(){var origin=${JSON.stringify(origin)};var text=(document.body&&document.body.innerText||"").replace(/\\s+/g," ").trim().slice(0,12000);var images=(function(){var found=[],og=document.querySelector('meta[property="og:image"]');if(og&&og.content)found.push(og.content);var list=document.images||[];for(var i=0;i<list.length;i++){var img=list[i],src=img.currentSrc||img.src||"",w=img.naturalWidth||img.width||0;if(w&&w<160)continue;if(!/^https?:/i.test(src))continue;if(/sprite|favicon|emoji|pixel|blank|logo/i.test(src))continue;found.push(src);}var uniq=[];for(var j=0;j<found.length&&uniq.length<8;j++){if(uniq.indexOf(found[j])<0)uniq.push(found[j]);}return uniq;})();var payload={sourceUrl:location.href,name:document.title,rawText:text,imageUrls:images};var json=JSON.stringify(payload);function openApp(){window.open(origin+"/import?from=bookmarklet","_blank");}function fallback(){window.prompt("Salin JSON ini, lalu tempel di Koscout.",json);openApp();}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(json).then(function(){window.alert("Teks, tautan, dan gambar disalin. Tempel di halaman impor Koscout.");openApp();}).catch(fallback);}else{fallback();}})();`;
  return script;
}

export const SAMPLE_LISTING = `Kos Melati Residence
Jl. Kapten Tendean No. 12, Jakarta Selatan
Kos putri
mulai dari Rp1.750.000/bulan
Fasilitas: AC, Wi-Fi, kamar mandi dalam, parkir motor
Listrik dan air ditanggung sendiri. Deposit 1 bulan.
Kamar tersedia.
https://example.com/kos-melati-baru`;

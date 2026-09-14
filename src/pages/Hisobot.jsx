import React, { useCallback, useEffect, useState } from 'react';
import { amal, pul, miqdorFmt, bugun, sanaQoshish, oyBoshi, sanaChiroyli, vaqtChiroyli } from '../api.js';
import { Modal, Tasdiq } from '../components/Ui.jsx';
import TovarTahlil from './TovarTahlil.jsx';


const AMAL_NOMI = {
  qoldiq_tuzatish: "Qoldiq qo'lda to'g'rilandi",
  sotuv_bekor: 'Chek bekor qilindi',
  kassa_hisobi: 'Kassa sanaldi',
  demo_qoshildi: "Demo tovarlar qo'shildi",
  sotuvlar_tozalandi: 'Sotuvlar tozalandi',
  hammasi_tozalandi: "Hamma ma'lumot tozalandi",
};

export default function Hisobot({ user, filial, toast }) {
  const [dan, setDan] = useState(bugun());
  const [gacha, setGacha] = useState(bugun());
  const [h, setH] = useState(null);
  const [tab, setTab] = useState('umumiy');
  const [sotuvlar, setSotuvlar] = useState([]);
  const [korish, setKorish] = useState(null);
  const [bekor, setBekor] = useState(null);
  const [qoldiq, setQoldiq] = useState([]);
  const [narxTarix, setNarxTarix] = useState([]);
  const [jurnal, setJurnal] = useState([]);
  const [kategoriya, setKategoriya] = useState([]);
  const [taminotchi, setTaminotchi] = useState(null);
  const rahbarmi = user.rol === 'rahbar';

  const yukla = useCallback(() => {
    amal('hisobot.oraliq', { dan, gacha, filial_id: filial })
      .then(setH)
      .catch((e) => toast.xato(e.message));
    amal('sotuv.royxat', { dan, gacha, filial_id: filial, limit: 500 })
      .then(setSotuvlar)
      .catch(() => {});
  }, [dan, gacha, filial]);

  useEffect(yukla, [yukla]);

  useEffect(() => {
    if (tab === 'ombor') amal('hisobot.qoldiq', { filial_id: filial }).then(setQoldiq).catch(() => {});
    if (tab === 'kategoriya') amal('hisobot.kategoriya', { dan, gacha, filial_id: filial }).then(setKategoriya).catch(() => {});
    if (tab === 'taminotchi') amal('hisobot.taminotchilar', { dan, gacha, filial_id: filial }).then(setTaminotchi).catch(() => {});
    if (tab === 'ozgarish') {
      amal('hisobot.narxTarix', { dan, gacha }).then(setNarxTarix).catch(() => {});
      if (rahbarmi) amal('hisobot.jurnal', { dan, gacha }).then(setJurnal).catch(() => {});
    }
  }, [tab, filial, dan, gacha]);

  function tezSana(tur) {
    if (tur === 'bugun') {
      setDan(bugun());
      setGacha(bugun());
    } else if (tur === 'kecha') {
      setDan(sanaQoshish(bugun(), -1));
      setGacha(sanaQoshish(bugun(), -1));
    } else if (tur === 'hafta') {
      setDan(sanaQoshish(bugun(), -6));
      setGacha(bugun());
    } else if (tur === 'oy') {
      setDan(oyBoshi());
      setGacha(bugun());
    } else if (tur === 'jami') {
      setDan('2000-01-01');
      setGacha(bugun());
    }
  }

  async function chekniBekorQil(s) {
    try {
      await amal('sotuv.bekor', { id: s.id, sabab: 'Rahbar tomonidan bekor qilindi' });
      toast.ok('Chek bekor qilindi, tovar omborga qaytdi');
      yukla();
    } catch (e) {
      toast.xato(e.message);
    }
  }

  async function qaytaChop(id) {
    try {
      await amal('sotuv.qaytaChop', { id });
      toast.ok('Chek qayta chop etildi');
    } catch (e) {
      toast.xato(e.message);
    }
  }

  return (
    <div className="sahifa">
      <div className="qator" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        <input type="date" className="inp" style={{ width: 160 }} value={dan} onChange={(e) => setDan(e.target.value)} />
        <span className="xira">—</span>
        <input type="date" className="inp" style={{ width: 160 }} value={gacha} onChange={(e) => setGacha(e.target.value)} />
        <button className="btn btn-kichik" onClick={() => tezSana('bugun')}>Bugun</button>
        <button className="btn btn-kichik" onClick={() => tezSana('kecha')}>Kecha</button>
        <button className="btn btn-kichik" onClick={() => tezSana('hafta')}>7 kun</button>
        <button className="btn btn-kichik" onClick={() => tezSana('oy')}>Shu oy</button>
        <button className="btn btn-kichik" onClick={() => tezSana('jami')}>Butun davr</button>
      </div>

      {!h ? (
        <div className="yuklanmoqda">Yuklanmoqda...</div>
      ) : (
        <>
          <div className="stat-setka">
            <Stat yorliq="Savdo" qiymat={pul(h.savdo)} izoh={`${h.chek_soni} ta chek`} />
            {rahbarmi && <Stat yorliq="Sof foyda" qiymat={pul(h.foyda)} rang="var(--yashil)" izoh={h.savdo > 0 ? `${Math.round((h.foyda / h.savdo) * 100)}%` : ''} />}
            <Stat yorliq="Naqd" qiymat={pul(h.kassa_naqd)} />
            <Stat yorliq="Karta" qiymat={pul(h.kassa_karta)} />
            <Stat yorliq="Terminal" qiymat={pul(h.kassa_terminal)} />
            {h.qarz > 0 && <Stat yorliq="Qarzga berilgan" qiymat={pul(h.qarz)} rang="var(--sariq)" />}
            {h.qarz_tolov > 0 && <Stat yorliq="Qarz to'lovi" qiymat={pul(h.qarz_tolov)} rang="var(--yashil)" />}
            {rahbarmi && h.kirim_jami > 0 && <Stat yorliq="Tovar kirimi" qiymat={pul(h.kirim_jami)} izoh={`${h.kirim_soni} ta`} />}
          </div>

          <div className="tab-qator" style={{ marginTop: 22 }}>
            {[
              ['umumiy', 'Umumiy'],
              ['cheklar', 'Cheklar'],
              ['kunlar', 'Kunlar kesimi'],
              ['ombor', 'Ombor qoldig\'i'],
            ].map(([k, n]) => (
              <button key={k} className={'tab' + (tab === k ? ' faol' : '')} onClick={() => setTab(k)}>
                {n}
              </button>
            ))}
          </div>

          {tab === 'umumiy' && (
            <div className="ustun-2" style={{ alignItems: 'start' }}>
              <div className="karta">
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Eng ko'p sotilgan tovarlar</h3>
                <table className="jadval">
                  <tbody>
                    {h.top.map((t, i) => (
                      <tr key={i}>
                        <td className="xira" style={{ width: 24 }}>{i + 1}</td>
                        <td>{t.nomi}</td>
                        <td className="ong">{miqdorFmt(t.miqdor)}</td>
                        <td className="ong qalin">{pul(t.summa)}</td>
                        {rahbarmi && <td className="ong" style={{ color: 'var(--yashil)' }}>{pul(t.foyda)}</td>}
                      </tr>
                    ))}
                    {!h.top.length && <tr><td className="xira">Ma'lumot yo'q</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="karta">
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Xodimlar kesimi</h3>
                <table className="jadval">
                  <tbody>
                    {h.hodimlar.map((x, i) => (
                      <tr key={i}>
                        <td>{x.ism}</td>
                        <td className="ong xira">{x.chek} chek</td>
                        <td className="ong qalin">{pul(x.savdo)}</td>
                        {rahbarmi && <td className="ong" style={{ color: 'var(--yashil)' }}>{pul(x.foyda)}</td>}
                      </tr>
                    ))}
                    {!h.hodimlar.length && <tr><td className="xira">Ma'lumot yo'q</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'cheklar' && (
            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Vaqt</th>
                    <th>Chek №</th>
                    <th>Xodim</th>
                    <th>Mijoz</th>
                    <th className="ong">Summa</th>
                    <th>To'lov</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sotuvlar.map((s) => (
                    <tr key={s.id}>
                      <td className="kichik">{vaqtChiroyli(s.sana)}</td>
                      <td className="kichik xira">{s.raqam}</td>
                      <td className="kichik">{s.hodim}</td>
                      <td className="kichik">{s.mijoz || '—'}</td>
                      <td className="ong qalin">{pul(s.jami)}</td>
                      <td className="kichik">
                        {s.naqd > 0 && <span className="nishon n-yashil" style={{ marginRight: 4 }}>naqd</span>}
                        {s.karta > 0 && <span className="nishon n-kok" style={{ marginRight: 4 }}>karta</span>}
                        {s.terminal > 0 && <span className="nishon n-kok" style={{ marginRight: 4 }}>terminal</span>}
                        {s.qarz > 0 && <span className="nishon n-sariq">qarz</span>}
                      </td>
                      <td className="ong">
                        <button className="btn btn-kichik" onClick={() => amal('sotuv.bitta', { id: s.id }).then(setKorish)}>
                          Ko'rish
                        </button>
                        <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => qaytaChop(s.id)}>
                          🖨
                        </button>
                        {rahbarmi && (
                          <button className="btn btn-kichik" style={{ marginLeft: 6 }} onClick={() => setBekor(s)}>
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!sotuvlar.length && (
                    <tr><td colSpan={7} className="markaz xira" style={{ padding: 30 }}>Bu davrda sotuv yo'q</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'tovarlar' && (
            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Tovar</th>
                    <th className="ong">Sotilgan (dona)</th>
                    <th className="ong">Summa</th>
                    {rahbarmi && <th className="ong">Foyda</th>}
                  </tr>
                </thead>
                <tbody>
                  {h.top.map((t, i) => (
                    <tr key={i}>
                      <td>{t.nomi}</td>
                      <td className="ong">{miqdorFmt(t.miqdor)}</td>
                      <td className="ong qalin">{pul(t.summa)}</td>
                      {rahbarmi && <td className="ong" style={{ color: 'var(--yashil)' }}>{pul(t.foyda)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'kunlar' && (
            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Kun</th>
                    <th className="ong">Cheklar</th>
                    <th className="ong">Savdo</th>
                    {rahbarmi && <th className="ong">Foyda</th>}
                  </tr>
                </thead>
                <tbody>
                  {h.kunlar.map((k) => (
                    <tr key={k.kun}>
                      <td>{sanaChiroyli(k.kun)}</td>
                      <td className="ong xira">{k.chek}</td>
                      <td className="ong qalin">{pul(k.savdo)}</td>
                      {rahbarmi && <td className="ong" style={{ color: 'var(--yashil)' }}>{pul(k.foyda)}</td>}
                    </tr>
                  ))}
                  {!h.kunlar.length && <tr><td colSpan={4} className="markaz xira" style={{ padding: 30 }}>Ma'lumot yo'q</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'ombor' && (
            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Tovar</th>
                    <th className="ong">Qoldiq</th>
                    {rahbarmi && <th className="ong">Tan narx</th>}
                    <th className="ong">Sotuv narx</th>
                    {rahbarmi && <th className="ong">Ombor qiymati</th>}
                  </tr>
                </thead>
                <tbody>
                  {qoldiq.map((t) => (
                    <tr key={t.id}>
                      <td>{t.nomi}</td>
                      <td className="ong">
                        <span className={'nishon ' + (t.qoldiq <= 0 ? 'n-qizil' : t.qoldiq <= t.min_qoldiq ? 'n-sariq' : 'n-yashil')}>
                          {miqdorFmt(t.qoldiq)}
                        </span>
                      </td>
                      {rahbarmi && <td className="ong xira">{pul(t.tan_narx)}</td>}
                      <td className="ong">{pul(t.sotuv_narx)}</td>
                      {rahbarmi && <td className="ong qalin">{pul(t.ombor_summa)}</td>}
                    </tr>
                  ))}
                </tbody>
                {rahbarmi && (
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="ong qalin">Ombor umumiy qiymati:</td>
                      <td className="ong qalin" style={{ fontSize: 16 }}>
                        {pul(qoldiq.reduce((s, t) => s + t.ombor_summa, 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

          {tab === 'tovar' && (
            <TovarTahlil dan={dan} gacha={gacha} filial={filial} toast={toast} rahbarmi={rahbarmi} />
          )}

          {tab === 'kategoriya' && (
            <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
              <table className="jadval">
                <thead>
                  <tr>
                    <th>Kategoriya</th>
                    <th className="ong">Cheklar</th>
                    <th className="ong">Sotilgan (dona)</th>
                    <th className="ong">Savdo</th>
                    <th className="ong">Ulush</th>
                    {rahbarmi && <th className="ong">Foyda</th>}
                  </tr>
                </thead>
                <tbody>
                  {kategoriya.map((k, i) => {
                    const jamiSavdo = kategoriya.reduce((s2, x) => s2 + x.savdo, 0) || 1;
                    const ulush = Math.round((k.savdo / jamiSavdo) * 100);
                    return (
                      <tr key={i}>
                        <td className="qalin">{k.kategoriya}</td>
                        <td className="ong xira">{k.chek}</td>
                        <td className="ong">{miqdorFmt(k.miqdor)}</td>
                        <td className="ong qalin">{pul(k.savdo)}</td>
                        <td className="ong">
                          <div className="qator" style={{ justifyContent: 'flex-end', gap: 8 }}>
                            <div style={{ width: 80, height: 8, background: 'var(--fon3)', borderRadius: 4 }}>
                              <div style={{ width: ulush + '%', height: '100%', background: 'var(--yashil)', borderRadius: 4 }} />
                            </div>
                            <span className="kichik xira" style={{ width: 34 }}>{ulush}%</span>
                          </div>
                        </td>
                        {rahbarmi && (
                          <td className="ong" style={{ color: 'var(--yashil)' }}>{pul(k.foyda)}</td>
                        )}
                      </tr>
                    );
                  })}
                  {!kategoriya.length && (
                    <tr>
                      <td colSpan={6} className="markaz xira" style={{ padding: 30 }}>Ma'lumot yo'q</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'taminotchi' && taminotchi && (
            <>
              <div className="stat-setka" style={{ marginBottom: 16 }}>
                <div className="stat">
                  <div className="stat-yorliq">Tovarga sarflangan</div>
                  <div className="stat-qiymat">{pul(taminotchi.jami_xarid)}</div>
                  <div className="stat-izoh">shu davrdagi kirimlar</div>
                </div>
                <div className="stat">
                  <div className="stat-yorliq">Sotilgan tovarning tan narxi</div>
                  <div className="stat-qiymat">{pul(taminotchi.sotilgan_tan)}</div>
                  <div className="stat-izoh">ya'ni qancha tovar pulga aylandi</div>
                </div>
                <div className="stat">
                  <div className="stat-yorliq">Savdo</div>
                  <div className="stat-qiymat" style={{ color: 'var(--yashil)' }}>{pul(taminotchi.savdo)}</div>
                </div>
              </div>

              {taminotchi.royxat.map((t, i) => (
                <div className="karta" key={i} style={{ marginBottom: 12 }}>
                  <div className="qator" style={{ marginBottom: 8 }}>
                    <b style={{ fontSize: 16 }}>{t.taminotchi}</b>
                    <span className="xira kichik">· {t.kirim_soni} ta kirim · oxirgi: {vaqtChiroyli(t.oxirgi)}</span>
                    <b className="qator-oxiri" style={{ fontSize: 17 }}>{pul(t.jami)} so'm</b>
                  </div>
                  <table className="jadval">
                    <thead>
                      <tr>
                        <th>Tovar</th>
                        <th className="ong">Olingan</th>
                        <th className="ong">O'rtacha narx</th>
                        <th className="ong">Summa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.tovarlar.map((x, j) => (
                        <tr key={j}>
                          <td>{x.nomi}</td>
                          <td className="ong">{miqdorFmt(x.miqdor)} dona</td>
                          <td className="ong xira">{pul(x.ortacha_narx)}</td>
                          <td className="ong qalin">{pul(x.summa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {!taminotchi.royxat.length && (
                <div className="karta markaz xira" style={{ padding: 30 }}>Bu davrda kirim bo'lmagan</div>
              )}
            </>
          )}

          {tab === 'ozgarish' && (
            <div className="ustun-2" style={{ alignItems: 'start' }}>
              <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
                <table className="jadval">
                  <thead>
                    <tr>
                      <th>Vaqt</th>
                      <th>Tovar</th>
                      <th>Nima</th>
                      <th className="ong">Eski</th>
                      <th className="ong">Yangi</th>
                      <th>Kim</th>
                    </tr>
                  </thead>
                  <tbody>
                    {narxTarix.map((n) => (
                      <tr key={n.id}>
                        <td className="kichik">{vaqtChiroyli(n.sana)}</td>
                        <td className="kichik qalin">{n.nomi}</td>
                        <td className="kichik">
                          <span className={'nishon ' + (n.tur === 'tan' ? 'n-sariq' : 'n-kok')}>
                            {n.tur === 'tan' ? 'kelgan narx' : 'sotuv narx'}
                          </span>
                          {n.sabab && <div className="xira" style={{ fontSize: 11 }}>{n.sabab}</div>}
                        </td>
                        <td className="ong xira">{pul(n.eski)}</td>
                        <td
                          className="ong qalin"
                          style={{ color: n.yangi > n.eski ? 'var(--qizil)' : 'var(--yashil)' }}
                        >
                          {pul(n.yangi)}
                          <span className="kichik" style={{ marginLeft: 4 }}>
                            {n.yangi > n.eski ? '↑' : '↓'}
                          </span>
                        </td>
                        <td className="kichik">{n.ism || '—'}</td>
                      </tr>
                    ))}
                    {!narxTarix.length && (
                      <tr>
                        <td colSpan={6} className="markaz xira" style={{ padding: 30 }}>
                          Bu davrda narx o'zgarmagan
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {rahbarmi && (
                <div className="karta" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
                  <table className="jadval">
                    <thead>
                      <tr>
                        <th>Vaqt</th>
                        <th>Amal</th>
                        <th>Kim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jurnal.map((j) => (
                        <tr key={j.id}>
                          <td className="kichik">{vaqtChiroyli(j.sana)}</td>
                          <td className="kichik">
                            <b>{AMAL_NOMI[j.amal] || j.amal}</b>
                            {j.tafsilot && <div className="xira" style={{ fontSize: 11 }}>{j.tafsilot}</div>}
                          </td>
                          <td className="kichik">{j.ism || '—'}</td>
                        </tr>
                      ))}
                      {!jurnal.length && (
                        <tr>
                          <td colSpan={3} className="markaz xira" style={{ padding: 30 }}>
                            Yozuv yo'q
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

      <Modal ochiq={!!korish} yop={() => setKorish(null)} sarlavha={`Chek №${korish?.sotuv?.raqam || ''}`}>
        {korish && (
          <>
            <p className="xira kichik" style={{ marginBottom: 12 }}>
              {vaqtChiroyli(korish.sotuv.sana)} · {korish.sotuv.hodim}
              {korish.sotuv.mijoz ? ` · ${korish.sotuv.mijoz}` : ''}
            </p>
            <table className="jadval">
              <tbody>
                {korish.qatorlar.map((q) => (
                  <tr key={q.id}>
                    <td>{q.nomi}</td>
                    <td className="ong xira">{miqdorFmt(q.miqdor)} × {pul(q.narx)}</td>
                    <td className="ong qalin">{pul(q.summa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="karta" style={{ marginTop: 14 }}>
              <div className="qator"><span>Jami</span><b className="qator-oxiri">{pul(korish.sotuv.jami)}</b></div>
              {korish.sotuv.naqd > 0 && <div className="qator kichik"><span className="xira">Naqd</span><span className="qator-oxiri">{pul(korish.sotuv.naqd)}</span></div>}
              {korish.sotuv.karta > 0 && <div className="qator kichik"><span className="xira">Karta</span><span className="qator-oxiri">{pul(korish.sotuv.karta)}</span></div>}
              {korish.sotuv.terminal > 0 && <div className="qator kichik"><span className="xira">Terminal</span><span className="qator-oxiri">{pul(korish.sotuv.terminal)}</span></div>}
              {korish.sotuv.qarz > 0 && <div className="qator kichik"><span className="xira">Qarzga</span><span className="qator-oxiri">{pul(korish.sotuv.qarz)}</span></div>}
              {rahbarmi && (
                <div className="qator kichik" style={{ marginTop: 6, color: 'var(--yashil)' }}>
                  <span>Foyda</span>
                  <b className="qator-oxiri">{pul(korish.sotuv.jami - korish.sotuv.tan_jami)}</b>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      <Tasdiq
        ochiq={!!bekor}
        yop={() => setBekor(null)}
        sarlavha="Chekni bekor qilish"
        matn={`№${bekor?.raqam} chek (${pul(bekor?.jami || 0)} so'm) bekor qilinadi. Tovarlar omborga qaytadi. Davom etasizmi?`}
        tugma="Ha, bekor qilish"
        tasdiqla={() => chekniBekorQil(bekor)}
      />
    </div>
  );
}

function Stat({ yorliq, qiymat, izoh, rang }) {
  return (
    <div className="stat">
      <div className="stat-yorliq">{yorliq}</div>
      <div className="stat-qiymat" style={rang ? { color: rang } : undefined}>{qiymat}</div>
      {izoh && <div className="stat-izoh">{izoh}</div>}
    </div>
  );
}

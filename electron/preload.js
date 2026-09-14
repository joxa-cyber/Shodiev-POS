const { contextBridge, ipcRenderer } = require('electron');

// UI faqat shu ko'prik orqali ishlaydi (xavfsiz)
contextBridge.exposeInMainWorld('pos', {
  // yangilanish holati haqida xabar (main -> UI)
  yangilanishKuzat: (f) => {
    const h = (_e, holat) => f(holat);
    ipcRenderer.on('yangilanish', h);
    return () => ipcRenderer.removeListener('yangilanish', h);
  },
  amal: async (nom, arg) => {
    const j = await ipcRenderer.invoke('amal', nom, arg);
    if (!j.ok) throw new Error(j.xato);
    return j.natija;
  },
});

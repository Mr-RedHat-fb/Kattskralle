const logLoaded = (settings) => {
    console.log('Kattskrälle loaded', settings);
};

const browserStorage = globalThis.browser?.storage;
const chromeStorage = globalThis.chrome?.storage;

if (browserStorage) {
    const storageArea = browserStorage.sync ?? browserStorage.local;
    if (storageArea) {
        storageArea.get(null)
            .then(logLoaded)
            .catch((error) => {
                console.warn('Kattskrälle storage read failed', error);
            });
    } else {
        console.warn('Kattskrälle loaded (storage unavailable)');
    }
} else if (chromeStorage) {
    const storageArea = chromeStorage.sync ?? chromeStorage.local;
    if (storageArea) {
        storageArea.get(null, logLoaded);
    } else {
        console.warn('Kattskrälle loaded (storage unavailable)');
    }
} else {
    console.warn('Kattskrälle loaded (storage unavailable)');
}

let loadingPromise: Promise<typeof google> | null = null;

export function loadGooglePlaces(apiKey?: string, language: string = 'es') {
	if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'));
	const g = (window as any).google;
	if (g?.maps?.places) return Promise.resolve(g as typeof google);
	if (!apiKey) return Promise.reject(new Error('Missing Google Maps API key'));
	if (!loadingPromise) {
		loadingPromise = new Promise((resolve, reject) => {
			const existing = document.querySelector('script[data-google-maps="1"]') as HTMLScriptElement | null;
			if (existing) {
				existing.addEventListener('load', () => resolve((window as any).google));
				existing.addEventListener('error', () => reject(new Error('Google Maps script failed')));
				return;
			}
			const script = document.createElement('script');
			script.type = 'text/javascript';
			script.async = true;
			script.defer = true;
			script.dataset.googleMaps = '1';
			script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&libraries=places&language=${encodeURIComponent(language)}`;
			script.onload = () => resolve((window as any).google);
			script.onerror = () => reject(new Error('Google Maps script failed'));
			document.head.appendChild(script);
		});
	}
	return loadingPromise;
}

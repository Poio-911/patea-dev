
// A custom dark map style inspired by the app's theme
export const mapStyles: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "hsl(var(--primary))" }],
    },
    // Ocultar POIs no deportivos
    {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.business",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.school",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.government",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "poi.medical",
        stylers: [{ visibility: "off" }]
    },
    // Mostrar y estilizar parques y complejos deportivos
    {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ "color": "#263c3f" }]
    },
    {
        featureType: "poi.park",
        elementType: "labels.text",
        stylers: [{ visibility: "on" }]
    },
    {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ "color": "#6b9a76" }]
    },
    {
        featureType: "poi.sports_complex",
        elementType: "geometry",
        stylers: [{ color: "hsl(var(--accent))" , "visibility": "on" }] // Use accent color for sports complexes
    },
    {
        featureType: "poi.sports_complex",
        elementType: "labels",
        stylers: [{ visibility: "on" }]
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ "color": "#38414e" }]
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ "color": "#212a37" }]
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ "color": "#9ca5b3" }]
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ "color": "#746855" }]
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ "color": "#1f2835" }]
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ "color": "#f3d19c" }]
    },
    {
        featureType: "transit",
        stylers: [{ visibility: "off" }]
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ "color": "#17263c" }] // Dark blue for water
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ "color": "#515c6d" }]
    },
    {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ "color": "#17263c" }]
    },
];

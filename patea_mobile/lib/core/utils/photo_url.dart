/// Helpers for normalizing optional profile and avatar image URLs.
String? nonEmptyPhotoUrl(String? url) {
  final trimmed = url?.trim();
  return (trimmed != null && trimmed.isNotEmpty) ? trimmed : null;
}

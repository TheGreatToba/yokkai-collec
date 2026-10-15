/* eslint-disable @next/next/no-img-element */

/** Portrait card art stays intact; uploaded banners keep their cover crop. */
export function ProfileBanner({
  uploadedUrl,
  characterImage
}: {
  uploadedUrl?: string | null;
  characterImage?: string | null;
}) {
  const image = uploadedUrl || characterImage;
  const character = Boolean(image && !uploadedUrl);
  return (
    <div
      className={`yk-profile-banner ${image ? "has-image" : ""} ${character ? "is-character" : ""}`}
    >
      {image && (
        <>
          {character && (
            <img
              className="yk-profile-banner-backdrop"
              src={image}
              alt=""
              aria-hidden="true"
              decoding="async"
            />
          )}
          <img
            className="yk-profile-banner-art"
            src={image}
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          <span className="yk-profile-banner-shade" />
        </>
      )}
    </div>
  );
}

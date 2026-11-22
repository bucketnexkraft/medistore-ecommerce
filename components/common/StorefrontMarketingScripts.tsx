import Script from "next/script";

type StorefrontMarketingScriptsProps = {
	gtmId?: string | null;
	facebookPixelId?: string | null;
	facebookTestEventId?: string | null;
	tiktokPixelId?: string | null;
};

const cleanValue = (value: string | null | undefined) => {
	const normalized = String(value || "").trim();
	return normalized !== "" ? normalized : null;
};

export function StorefrontMarketingScripts({
	gtmId,
	facebookPixelId,
	facebookTestEventId,
	tiktokPixelId,
}: StorefrontMarketingScriptsProps) {
	const normalizedGtmId = cleanValue(gtmId);
	const normalizedFacebookPixelId = cleanValue(facebookPixelId);
	const normalizedFacebookTestEventId = cleanValue(facebookTestEventId);
	const normalizedTiktokPixelId = cleanValue(tiktokPixelId);

	return (
		<>
			{normalizedGtmId ? (
				<>
					<Script
						id="storefront-gtm"
						strategy="afterInteractive"
						dangerouslySetInnerHTML={{
							__html: `
								(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
								new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
								j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
								'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
								})(window,document,'script','dataLayer','${normalizedGtmId}');
							`,
						}}
					/>
					<noscript>
						<iframe
							src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(normalizedGtmId)}`}
							height="0"
							width="0"
							style={{ display: "none", visibility: "hidden" }}
						/>
					</noscript>
				</>
			) : null}

			{normalizedFacebookPixelId ? (
				<Script
					id="storefront-facebook-pixel"
					strategy="afterInteractive"
					dangerouslySetInnerHTML={{
						__html: `
							!function(f,b,e,v,n,t,s)
							{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
							n.callMethod.apply(n,arguments):n.queue.push(arguments)};
							if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
							n.queue=[];t=b.createElement(e);t.async=!0;
							t.src=v;s=b.getElementsByTagName(e)[0];
							s.parentNode.insertBefore(t,s)}(window, document,'script',
							'https://connect.facebook.net/en_US/fbevents.js');
							fbq('init', '${normalizedFacebookPixelId}');
							fbq('track', 'PageView');
							${normalizedFacebookTestEventId ? `fbq('trackCustom', 'TestEvent', {}, {eventID: '${normalizedFacebookTestEventId}'});` : ""}
						`,
					}}
				/>
			) : null}

			{normalizedTiktokPixelId ? (
				<Script
					id="storefront-tiktok-pixel"
					strategy="afterInteractive"
					dangerouslySetInnerHTML={{
						__html: `
							!function (w, d, t) {
								w.TiktokAnalyticsObject=t;
								var ttq=w[t]=w[t]||[];
								ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
								ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
								for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
								ttq.load=function(e,n){
									var r="https://analytics.tiktok.com/i18n/pixel/events.js";
									ttq._i=ttq._i||{};
									ttq._i[e]=[];
									ttq._i[e]._u=r;
									ttq._t=ttq._t||{};
									ttq._t[e]=+new Date;
									ttq._o=ttq._o||{};
									ttq._o[e]=n||{};
									var o=document.createElement("script");
									o.type="text/javascript";
									o.async=!0;
									o.src=r+"?sdkid="+e+"&lib="+t;
									var a=document.getElementsByTagName("script")[0];
									a.parentNode.insertBefore(o,a)
								};
								ttq.load('${normalizedTiktokPixelId}');
								ttq.page();
							}(window, document, 'ttq');
						`,
					}}
				/>
			) : null}
		</>
	);
}

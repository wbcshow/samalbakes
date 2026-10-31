/** Default promotions for demo mode and initial database setup. Live offers are managed in Admin. */

window.SAMALBAKES = window.SAMALBAKES || {};

window.SAMALBAKES.promos = [
  {
    id: "welcome10",
    code: "SAMALWELCOME",
    title: "First-order welcome",
    description: "10% off your first online order. First orders only, one per customer. Use code SAMALWELCOME at checkout.",
    type: "percent",
    percentOff: 10,          // PLACEHOLDER
    audience: "new customers",
    active: true,
  },
  {
    id: "free-del",
    code: "FREESHIP1500",
    title: "Free delivery over ₱1,500",
    description: "Orders of ₱1,500 or more qualify for free delivery within our area.",
    type: "free_delivery",
    minSubtotal: 1500,       // PLACEHOLDER — sync with config.delivery.freeDeliveryMinOrder
    audience: "everyone",
    active: true,
  },
  {
    id: "cafe-wholesale",
    code: null,
    title: "Coffee shop & resort wholesale",
    description: "Standing orders and wholesale pricing for cafés and resorts on Samal & Davao. Message us for a custom quote.",
    type: "info",
    audience: "B2B",
    active: true,
  },
  {
    id: "tasting-box",
    code: "TASTEBOX",
    title: "Free tasting box for businesses",
    description: "New café or resort partners: request a complimentary tasting box (subject to availability). Mention TASTEBOX when you message us.",
    type: "info",
    audience: "B2B",
    active: true,
  },
  {
    id: "resort50",
    code: "RESORT50",
    title: "Resort partner intro",
    description: "₱50 off orders ₱800+ for verified resort / hotel partners. Use code RESORT50.",
    type: "fixed",
    amountOff: 50,           // PLACEHOLDER
    minSubtotal: 800,        // PLACEHOLDER
    audience: "resorts",
    active: true,
  },
];

window.SAMALBAKES.promotionRules = {
 available: function(p,now){now=now||Date.now();return p.active && (!p.startsAt||Date.parse(p.startsAt)<=now)&&(!p.endsAt||Date.parse(p.endsAt)>now);},
 validate: function(list){
 if(!Array.isArray(list)||list.length>100)throw new Error('Use at most 100 promotions.');
 var codes={};return list.map(function(p){var r=Object.assign({},p);r.code=String(p.code||'').trim().toUpperCase();r.title=String(p.title||'').trim();
 if(!r.title)throw new Error('Enter a promotion title.');
 if(['percent','fixed','free_delivery','info'].indexOf(r.type)<0)throw new Error('Choose a valid promotion type.');
 if(r.type!=='info'&&!r.code)throw new Error('Enter a discount code.');
 if(r.code&&(!/^[A-Z0-9_-]{1,40}$/.test(r.code)||codes[r.code]))throw new Error('Codes must be unique and contain letters, numbers, underscores or hyphens.');codes[r.code]=true;
 ['minSubtotal','percentOff','amountOff'].forEach(function(k){r[k]=Number(r[k]||0);if(!Number.isFinite(r[k])||r[k]<0)throw new Error('Amounts must be zero or greater.');});
 if(r.type==='percent'&&(r.percentOff<=0||r.percentOff>100))throw new Error('Percentage must be greater than zero and at most 100.');
 if(r.type==='fixed'&&r.amountOff<=0)throw new Error('Peso discount must be greater than zero.');
 ['startsAt','endsAt'].forEach(function(k){if(r[k]&&!Number.isFinite(Date.parse(r[k])))throw new Error('Enter valid dates.');});
 if(r.startsAt&&r.endsAt&&Date.parse(r.startsAt)>=Date.parse(r.endsAt))throw new Error('End must be after start.');return r;});
 }
};

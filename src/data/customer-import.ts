// Auto-generated from VehicleHaul CSV export 2026-03-31
// Call mergeImportedCustomers() to load into localStorage
// Abbreviation = code (airport-style), Name = full business name

import { getLocations, saveLocations, generateId } from "@/lib/store";
import { LocationProfile } from "@/lib/types";

interface RawCustomer {
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
}

// Parsed from CSV — code is the abbreviation, displayed like an airport code
const IMPORTED: RawCustomer[] = [
{code:"TC",name:"Terryville Chevrolet",contact:"TY 860 983 7337/Bob D. cell 860-690-8786",phone:"(860)582-7434",email:"",address:"PO Box 50, 302 Main Street, Terryville, CT 06786",city:"Terryville",state:"CT"},
{code:"GUCC",name:"Gucci Services",contact:"Anthony",phone:"516 760 0361",email:"ajgucciardi38@gmail.com",address:"",city:"",state:""},
{code:"MT",name:"Mills Transportation Service",contact:"HARRY",phone:"914 213 1259",email:"harry.mills311@gmail.com",address:"2077 Rt 208, Montgomery, NY 12549",city:"Montgomery",state:"NY"},
{code:"ROCK RIDGE",name:"Rocky Ridge Auto Sales & Service",contact:"Jeremy",phone:"717 733 8985",email:"jeremy@rockyridgeautosales.com",address:"480 N Reading Road, Ephrata, PA 17522",city:"Ephrata",state:"PA"},
{code:"KA",name:"Keaney Auto",contact:"John 914 438 1121",phone:"914 423 0238",email:"keaneyauto@optonline.net",address:"1012 Saw Mill river Road, Yonkers, NY 10710",city:"Yonkers",state:"NY"},
{code:"TS",name:"Thrifty Springfield",contact:"David 413 246 5055",phone:"413-562-1000",email:"ddicienzo@outlook.com",address:"300 East Main Street, Westfield, MA 01085",city:"Westfield",state:"MA"},
{code:"UROAD",name:"United Road Carmax",contact:"",phone:"734 947 7900",email:"stsmith@unitedroad.com",address:"10701 Middlebelt Road, Romulus, MI 48174",city:"Romulus",state:"MI"},
{code:"AA",name:"Aldrich Automotive",contact:"Steve",phone:"845 485 2070",email:"aldrichwholesale@aol.com",address:"1564 Route 9G, Hyde Park, NY 12538",city:"Hyde Park",state:"NY"},
{code:"WF",name:"Wayne Auto Sales Inc.",contact:"Gail Flanagan A/P",phone:"(973)256-8800",email:"",address:"444 State Route 46, Wayne, NJ 07470",city:"Wayne",state:"NJ"},
{code:"ST",name:"Scott Transportation Brokerage",contact:"Andy Scott",phone:"800-993-0063",email:"accounting@scotttransportation.com",address:"PO Box 380, Broad Brook, CT 06016-0380",city:"Broad Brook",state:"CT"},
{code:"POUGHN",name:"Poughkeepsie Nissan",contact:"VINNIE",phone:"845 297 0077",email:"VINNIECTS@GMAIL.COM",address:"1445 RT 9, WAPPINGERS FALLS, NY 12590",city:"Wappingers Falls",state:"NY"},
{code:"BM",name:"Brooklyn Mitsubishi",contact:"Andreas",phone:"7183451600",email:"andreas@brooklynmitsubishi.com",address:"599 E. 56th st., Brooklyn, NY 11203",city:"Brooklyn",state:"NY"},
{code:"KN",name:"Koeppel Nissan",contact:"Susan Leslie Ext385",phone:"718-898-7800",email:"acctspayable@koeppelautogroup.com",address:"74-15 Northern Blvd, Jackson Heights, NY 11372",city:"Jackson Heights",state:"NY"},
{code:"DA",name:"Diversified Automotive",contact:"",phone:"800-666-9007",email:"danielle.salvato@diversifiedautomotive.com",address:"100 Terminal Street, Charlestown, MA 02129",city:"Charlestown",state:"MA"},
{code:"EN",name:"Enterprise-IY Newburgh",contact:"Teri 603 264 9311",phone:"",email:"theresa.r.bradley@em.com",address:"2000 Dealer Drive, Newburgh, NY 12550",city:"Newburgh",state:"NY"},
{code:"DD",name:"Dutchess Dodge",contact:"",phone:"845-462-770",email:"philr@dutchesscars.com",address:"2285 South Road, Poughkeepsie, NY 12601",city:"Poughkeepsie",state:"NY"},
{code:"RC",name:"Richard Caturano",contact:"",phone:"617-877-5999",email:"",address:"",city:"",state:""},
{code:"UA",name:"Ultimate Auto Transport",contact:"",phone:"973-332-1193",email:"ultimateautotransport@gmail.com",address:"18 Lincoln Ave, Livingston, NJ 07039",city:"Livingston",state:"NJ"},
{code:"MC",name:"Mike Cerreta Auto Sales",contact:"",phone:"914-576-2252",email:"",address:"21 Huguenot St, New Rochelle, NY 10801",city:"New Rochelle",state:"NY"},
{code:"CF",name:"Cross Flag Enterprise",contact:"Scott",phone:"845-527-1056",email:"r6s6f2010@yahoo.com",address:"10 Lyons Lane, Milton, NY 12547",city:"Milton",state:"NY"},
{code:"LF",name:"Lucas Ford L/M",contact:"David",phone:"631-795-9200",email:"teresa@lucasfordlm.com",address:"3245 Hortons Ln, PO Box 1575, Southold, NY 11971",city:"Southold",state:"NY"},
{code:"GU",name:"Goodson Used Cars",contact:"Francisco Mejia",phone:"631-645-2881",email:"goodsonusedcars@gmail.com",address:"1264 Suffolk Ave, Brentwood, NY 11717",city:"Brentwood",state:"NY"},
{code:"BA",name:"Brothers Auto Transport",contact:"Garry",phone:"610-863-0200",email:"wcarlin@brothersautotransport.com",address:"PO Box 160, Wing Gap, PA 18091",city:"Wing Gap",state:"PA"},
{code:"KK",name:"Kelemen Kars",contact:"",phone:"717-247-9893",email:"sales@sellmemorecars.com",address:"169A Little Britain Rd, Newburgh, NY 12550",city:"Newburgh",state:"NY"},
{code:"DAB",name:"Delta Auto Brokers",contact:"David",phone:"908-526-3400",email:"dispatch@deltaautotransport.com",address:"125 Foothill Rd, Boundbrook, NJ 08805",city:"Boundbrook",state:"NJ"},
{code:"KH",name:"Koeppel Hyundai",contact:"",phone:"",email:"",address:"34-54 44TH ST, QUEENS, NY 11101",city:"Queens",state:"NY"},
{code:"BM2",name:"Belford Motor Company",contact:"Steve 201-888-8320",phone:"732-787-3600",email:"mdescalzi@belfordmotors.com",address:"PO Box 185, Belford, NJ 07718",city:"Belford",state:"NJ"},
{code:"SM",name:"Spackenkill Motors",contact:"Dean",phone:"914-489-9709",email:"spackmotors@optonline.net",address:"2490 South Road, Poughkeepsie, NY 12601",city:"Poughkeepsie",state:"NY"},
{code:"JW",name:"Janis Wholesale DBA NJ Liberty Motors",contact:"Jorge",phone:"732-887-6055",email:"jnarvaez@njlibertymotors.com",address:"59 Liberty St, Newark, NJ 07102",city:"Newark",state:"NJ"},
{code:"UF",name:"United Ford LLC",contact:"Matt Levinter",phone:"201-617-0700",email:"",address:"330 County Ave, Secaucus, NJ 07094",city:"Secaucus",state:"NJ"},
{code:"ACI",name:"ACI Transport",contact:"Tyler Huber",phone:"855 208 2811",email:"operations@ACITransport.com",address:"320 W. 9 Mile Rd, Ferndale, MI 48220",city:"Ferndale",state:"MI"},
{code:"WS",name:"World Star Auto Sales Inc",contact:"",phone:"718-777-7447",email:"worldstaruatosales@gmail.com",address:"70-51 Queens Blvd, Queens, NY 11377",city:"Queens",state:"NY"},
{code:"M",name:"Metrogistics",contact:"",phone:"877-571-6235",email:"",address:"110 Rock Cliff Court, Saint Louis, MO 21030",city:"Saint Louis",state:"MO"},
{code:"KM",name:"Koeppel Mazda",contact:"",phone:"",email:"yramirez@koeppelautogroup.com",address:"74-15 Northern Blvd, Jackson Heights, NY 11372",city:"Jackson Heights",state:"NY"},
{code:"SASI",name:"Southern Auto Sales (SASI)",contact:"Marybeth or Donna",phone:"860 292 7500",email:"",address:"PO Box 388, E. Windsor, CT 06088",city:"E. Windsor",state:"CT"},
{code:"LOM FRD",name:"Lombard Ford",contact:"",phone:"860 379 3301",email:"gfogarty@lombardford.com",address:"Rt 44 South, Barkhamsted, CT 06063",city:"Barkhamsted",state:"CT"},
{code:"MAWFRD",name:"Mahwah Ford Sales & Service",contact:"",phone:"(201)529-3200",email:"",address:"PO Box 734, Mahwah, NJ 07430",city:"Mahwah",state:"NJ"},
{code:"LIATOY",name:"Lia Toyota of Rockland",contact:"Ralph Arditit",phone:"845 358 2220 xt1152",email:"rarditi@liacars.com",address:"618 Route 303, Blauvelt, NY 10913",city:"Blauvelt",state:"NY"},
{code:"NAPNISS",name:"Napoli Nissan",contact:"John Michenko 845 893 8191",phone:"203 877 5141",email:"",address:"688 Bridgeport Ave, Milford, CT 06460",city:"Milford",state:"CT"},
{code:"NAP IN",name:"Napoli Indoor/Suzuki",contact:"",phone:"203 783 5850",email:"",address:"241 Boston Post Road, Milford, CT 06460",city:"Milford",state:"CT"},
{code:"SHAKEFAMHY",name:"Shaker's Family Hyundai",contact:"Corey shaker",phone:"(860)631-4200",email:"corey@shakerautogroup.com",address:"674 Straits Tpke, Watertown, CT 06795",city:"Watertown",state:"CT"},
{code:"SOUTH SHORE",name:"South Shore Chrysler Jeep Dodge",contact:"",phone:"(516)371-1500",email:"rmarte@sscdjr.com",address:"550 Burnside Ave, Inwood, NY 11096",city:"Inwood",state:"NY"},
{code:"DM",name:"Discount Motors",contact:"Bobby",phone:"845 375 9903",email:"",address:"875 Blooming Grove, Vails Gate, NY 12584",city:"Vails Gate",state:"NY"},
{code:"BG WATER",name:"Buick GMC of Watertown",contact:"Bob Manning 203 417 7057",phone:"860 945 4755",email:"christine.martin@ingersollauto.com",address:"84 Federal Road, Danbury, CT 06810",city:"Danbury",state:"CT"},
{code:"STAM FLM",name:"Stamford Ford Lincoln Mercury",contact:"",phone:"",email:"",address:"212 Mage Ave, Stamford, CT 06902",city:"Stamford",state:"CT"},
{code:"CURRYAC",name:"Curry Acura",contact:"Yuri Abramov 646 662 5416",phone:"914 472 6800",email:"yabramov@curryacura.com",address:"685 Central Park Ave, Scarsdale, NY 10583",city:"Scarsdale",state:"NY"},
{code:"RZM",name:"Raizman Auto",contact:"Steve 914 475 9356",phone:"845 691 9800",email:"sraizman@aol.com",address:"389 State Route 299, Highland, NY 12528",city:"Highland",state:"NY"},
{code:"HONNEWROCH",name:"Honda of New Rochelle",contact:"Joe Carusone cell 929 428 4286",phone:"914 825 5879",email:"jcarusone@hondaofnewrochelle.com",address:"25 East Main Street, New Rochelle, NY 10801",city:"New Rochelle",state:"NY"},
{code:"VT",name:"Virginia Transportation",contact:"",phone:"401-821-2900",email:"AR@virginiatransportation.com",address:"141 James P Murphy Ind Hwy, West Warwick, RI 02893",city:"West Warwick",state:"RI"},
{code:"LB",name:"Loehmann Blasius",contact:"KATHLEEN RAIMO Comptroller 203 437 4141",phone:"(203)753-9261",email:"",address:"200 Interstate Lane, Waterbury, CT 06723",city:"Waterbury",state:"CT"},
{code:"TRITWN",name:"Tritown Truck",contact:"",phone:"(860)274-3310",email:"tritowntrucks@gmail.com",address:"1360 Main Street, Watertown, CT 06795",city:"Watertown",state:"CT"},
{code:"VICEID",name:"Victor Eid Auto",contact:"",phone:"(518)376-9246",email:"victorsauto2003@yahoo.com",address:"644 Pawling Ave, Troy, NY 12180",city:"Troy",state:"NY"},
{code:"INGAUTOPAW",name:"Ingersoll Auto of Pawling",contact:"Bob Manning 845 319 7929",phone:"845 878 6900",email:"",address:"55 Route 22, Pawling, NY 12564",city:"Pawling",state:"NY"},
{code:"LITCHFRD",name:"Litchfield Ford",contact:"",phone:"860 567 3520",email:"geri.laukevicz@litchfieldford.com",address:"PO Box 940, Litchfield, CT 06759",city:"Litchfield",state:"CT"},
{code:"BREWSUB",name:"Brewster Subaru",contact:"",phone:"845 278 8300",email:"jackie@brewster-subaru.com",address:"1021 Route 22, PO Box 399, Brewster, NY 10509",city:"Brewster",state:"NY"},
{code:"QL",name:"Quality Locators",contact:"Rick Herth",phone:"570-582-7171",email:"qialitylocators@yahoo.com",address:"775 Havenridge DR SW, Conyers, GA 30094",city:"Conyers",state:"GA"},
{code:"DFINK",name:"Dennis Fink Trucking Inc",contact:"DENNIS FINK",phone:"518 755 3663",email:"DENNISFINKTRUCKING@YAHOO.COM",address:"4871 RT 9G, GERNMANTOWN, NY 12526",city:"Germantown",state:"NY"},
{code:"DF",name:"DMS First Class Auto Sales",contact:"Jerry Ramos 917 417 1361",phone:"845 293 0333",email:"iamjerrylewis141@gmail.com",address:"1 Hadden Dr, Montgomery, NY 12549",city:"Montgomery",state:"NY"},
{code:"MCFRD",name:"McMahon Ford",contact:"",phone:"203 838 4801",email:"",address:"1 Main Street, Norwalk, CT 06851",city:"Norwalk",state:"CT"},
{code:"COLFRD",name:"Colonial Ford",contact:"",phone:"203 748 3503",email:"traceyp@colonialautomobile.com",address:"PO Box 1126, Danbury, CT 06813",city:"Danbury",state:"CT"},
{code:"HEALEY",name:"Healey Brothers Inc",contact:"Otto",phone:"845 291 1998",email:"",address:"",city:"Newburgh",state:"NY"},
{code:"WL",name:"Wiz Leasing",contact:"kyle",phone:"203 882 1111",email:"kyle@wizautos.com",address:"250 Ferry Blvd, Stratford, CT 06615",city:"Stratford",state:"CT"},
{code:"NISSYH",name:"Nissan Of Yorktown Heights",contact:"",phone:"",email:"rodm@nissanyh.com",address:"3495 Crompond Road, Yorktown Heights, NY 10598",city:"Yorktown Heights",state:"NY"},
{code:"DAG",name:"Danbury Auto Group",contact:"Scott Zwiebel 203 910 1686",phone:"",email:"danburyautogroup@outlook.com",address:"33 Rose Street, Danbury, CT 06810",city:"Danbury",state:"CT"},
{code:"JL",name:"JC Lopez Auto Sales",contact:"",phone:"914 305 1579",email:"",address:"305 Willett Ave, Port Chester, NY 10573",city:"Port Chester",state:"NY"},
{code:"NILLES",name:"Nil Les Auto",contact:"Bill",phone:"610 633 3973",email:"nillisauto@aol.com",address:"8 Goldfinch Circle, Phoenixville, PA 19460",city:"Phoenixville",state:"PA"},
{code:"FF",name:"Friendly Ford",contact:"Mark Mazzoni 845 527 5923",phone:"(845)462-1900",email:"jarouca@friendlyfordny.com",address:"2250 South Road, Poughkeepsie, NY 12601",city:"Poughkeepsie",state:"NY"},
{code:"TORRHY",name:"Torrington Hyundai",contact:"Mike Alfano 860 601 2429",phone:"860 489 0471",email:"office@torringtonhyundai.com",address:"1446 E. Main Street, Torrington, CT 06790",city:"Torrington",state:"CT"},
{code:"WHAL FORD",name:"Whaling City Ford",contact:"Don",phone:"860 443 8361",email:"",address:"475 Broad Streeet, New London, CT 06320",city:"New London",state:"CT"},
{code:"LW",name:"Lincoln White Plains",contact:"Angelo",phone:"914 946 2100",email:"",address:"250 E Main Street, Elmsford, NY 10523",city:"Elmsford",state:"NY"},
{code:"LH",name:"Liberty Hyundai",contact:"",phone:"2015292400",email:"",address:"305 ROUTE 17 NORTH, MAHWAH, NJ 07430",city:"Mahwah",state:"NJ"},
{code:"FL",name:"Fine Line Transportation",contact:"Derick",phone:"717 625 0008",email:"derick@finelinetransport.com",address:"177 Green Acre Road, Lititz, PA 17543",city:"Lititz",state:"PA"},
{code:"A",name:"Acertus",contact:"",phone:"888 265 5690",email:"",address:"110 Rock Cliff Ct, Suite 2D, Saint Louis, MO 63123",city:"Saint Louis",state:"MO"},
{code:"FU",name:"Feliz Used Auto Sales",contact:"Feliz 203 942 1260",phone:"203-796-0277",email:"felizusedautosales@hotmail.com",address:"57 1/2 Liberty Street, Danbury, CT 06810",city:"Danbury",state:"CT"},
{code:"VAL FRD",name:"Valenti Ford",contact:"",phone:"860 536 4931",email:"",address:"72 Jerry Browne Road, Mystic, CT 06355",city:"Mystic",state:"CT"},
{code:"KINGNISS",name:"Romeo Nissan of Kingston",contact:"",phone:"845 338 3100",email:"George.McEvoy@romeoautogroup.com",address:"140 Rt 208, Kingston, NY 12401",city:"Kingston",state:"NY"},
{code:"NEWROCHTOY",name:"New Rochelle Toyota",contact:"Steve Ganiaris",phone:"914 576 8000",email:"steveg@newrochelletoyota.com",address:"47 Cedar St, New Rochelle, NY 10801",city:"New Rochelle",state:"NY"},
{code:"SF",name:"Schultz Ford",contact:"Craig 845 709 9294",phone:"845-624-3600",email:"craigs@schultzfordlincoln.com",address:"80 NY-304, Nanuet, NY 10954",city:"Nanuet",state:"NY"},
{code:"AB",name:"Autos By Joseph",contact:"Joey",phone:"845 691 5500",email:"mebe111@aol.com",address:"354 Vineyard Ave, Highland, NY 12528",city:"Highland",state:"NY"},
{code:"BMWR",name:"BMW of Ridgefield",contact:"",phone:"203 438 0471",email:"",address:"746 Danbury Road, Ridgefield, CT 06877",city:"Ridgefield",state:"CT"},
{code:"BH",name:"Bran Haven C/J/D",contact:"John Sullo 203 410 7908",phone:"203 488 1935",email:"jsullo@branhaven.com",address:"348 West Main Street, Branford, CT 06405",city:"Branford",state:"CT"},
{code:"AA AUTO",name:"Absolutely Automotive",contact:"",phone:"845 263 3720",email:"absolutelyauto1@aol.com",address:"1024 Route 9W, Marlboro, NY 12542",city:"Marlboro",state:"NY"},
{code:"EO",name:"Ed Oshea",contact:"",phone:"914 475 0618",email:"",address:"1 Deyo Pl, Newburgh, NY 12550",city:"Newburgh",state:"NY"},
{code:"CM",name:"Colonial Mazda",contact:"",phone:"",email:"traceyp@colonialautomobile.com",address:"100 C Federal Road, Danbury, CT 06810",city:"Danbury",state:"CT"},
{code:"AAA",name:"Americas Auto Auction",contact:"Clint 717 773 7182",phone:"717 697 222",email:"Clint.Weaver@americasautoauction.com",address:"1100 S York St, Mechanisburg, PA 17055",city:"Mechanisburg",state:"PA"},
{code:"A&D",name:"A&D Specialist",contact:"",phone:"",email:"",address:"223 South Main Street, Manheim, PA 17545",city:"Manheim",state:"PA"},
{code:"PC",name:"Park City Ford",contact:"alan merriam 203 676 5618",phone:"203 366 3425",email:"",address:"60 76 North Ave, Bridgeport, CT 06606",city:"Bridgeport",state:"CT"},
{code:"NBG",name:"Manheim New York",contact:"John Gorman 845 567 8573",phone:"845 567 8400",email:"",address:"PO Box 10900, Newburgh, NY 12552",city:"Newburgh",state:"NY"},
{code:"SL",name:"Shaker's Family Ford L/M",contact:"Richie B",phone:"860 945 4900",email:"",address:"674 Straits Turnpike, Watertown, CT 06795",city:"Watertown",state:"CT"},
{code:"AO",name:"Acura of Bedford Hills",contact:"Igor Minevich xt 104",phone:"914 666 2120",email:"iminevich@acuraofbedfordhills.com",address:"700 Bedford Road, Bedford Hills, NY 10507",city:"Bedford Hills",state:"NY"},
{code:"UA2",name:"UB Auto Sales",contact:"Joe U",phone:"845 656 7373",email:"",address:"997 Little Britain Road Suite B, New Windsor, NY 12553",city:"New Windsor",state:"NY"},
{code:"GS",name:"German Stars Motor LLC",contact:"Wasem 717 916 9899",phone:"416 557 7000 xt123",email:"cherry@germanstarmotors.ca",address:"900 Broad Street, Wadsworth, OH 44281",city:"Wadsworth",state:"OH"},
{code:"SF2",name:"Stevens Ford",contact:"Mike Kozak UCM ext 5481",phone:"203 876 6464",email:"MKozak@stevensautogroup.com",address:"707 BRIDGEPORT AVE, MILFORD, CT 06460",city:"Milford",state:"CT"},
{code:"LA",name:"L&S Auto Sales",contact:"",phone:"845 858 2886",email:"",address:"191 E. Main Street, Port Jervis, NY 12771",city:"Port Jervis",state:"NY"},
{code:"HVCDJ",name:"Hudson Valley Chrysler Dodge Jeep",contact:"",phone:"845 562 4100",email:"",address:"200 Auto Park Place, Newburgh, NY 12550",city:"Newburgh",state:"NY"},
{code:"CURRY TOY",name:"Curry Toyota",contact:"Joe Addimandi 917 602 9058",phone:"914 528 4347",email:"jaddimandi@curryautomotive.com",address:"3026 E. Main Street, Cortlandt Manor, NY 10567",city:"Cortlandt Manor",state:"NY"},
{code:"HH",name:"Huntington Honda",contact:"",phone:"631 423 6777",email:"",address:"1055 E. Jericho Turnpike, Huntington, NY 11743",city:"Huntington",state:"NY"},
{code:"BEST FORD",name:"Nashua Motor Sales DBA Best Ford",contact:"tom sullivan 978 760 2382",phone:"603 889 0161",email:"",address:"579 Amherst St, Nashua, NH 03063",city:"Nashua",state:"NH"},
{code:"ALLAM",name:"All American Ford/Subaru",contact:"",phone:"732 591 1111",email:"",address:"3698 US Highway 9, Old Bridge, NJ 08857",city:"Old Bridge",state:"NJ"},
{code:"DASH",name:"Dash Auto Logistics",contact:"Patrick",phone:"2487390332",email:"patrickg@dashdelivers.net",address:"52437 Trailwood Drive, South Lyon, IN 48178",city:"South Lyon",state:"IN"},
{code:"FAMILY",name:"Family Ford of Enfield",contact:"",phone:"860-745-1111",email:"",address:"65 Hazard Ave, Enfield, CT 06082",city:"Enfield",state:"CT"},
{code:"CURRY HYU",name:"Curry Hyundai Subaru",contact:"Sam/Eric",phone:"914 930 3700",email:"",address:"3040 E Main St, Cortlandt Manor, NY 10567",city:"Cortlandt Manor",state:"NY"},
{code:"NYE",name:"Nye Motor Company",contact:"Joel",phone:"717 665 7400",email:"nyemotor@gmail.com",address:"935 Lancaster Road, Manheim, PA 17545",city:"Manheim",state:"PA"},
{code:"DD2",name:"Drivers Depot",contact:"",phone:"860 614 9696",email:"",address:"202-3 S Main Street, East Windsor, CT 06088",city:"East Windsor",state:"CT"},
{code:"MN",name:"Manheim New Jersey",contact:"609-864-4240 Lloyd Tatem",phone:"",email:"steven.patrylow@coxautoinc.com",address:"",city:"",state:"NJ"},
{code:"MA",name:"Manheim Albany",contact:"",phone:"518 371 7500",email:"",address:"459 NY 146, Clifton Park, NY 12065",city:"Clifton Park",state:"NY"},
{code:"SCARS FRD",name:"Scarsdale Ford",contact:"Robert Knapp 914 804 5935",phone:"914 472 9500",email:"rknapp@scarsdaleford.com",address:"887 Central Park Ave, Scarsdale, NY 10583",city:"Scarsdale",state:"NY"},
{code:"WALWISE",name:"Wallet Wise Wheels",contact:"Kyle",phone:"845 239 1976",email:"kbyrons24@gmail.com",address:"680 Rt 17K, Montgomery, NY 12549-2707",city:"Montgomery",state:"NY"},
{code:"HV",name:"Hudson Valley Chrysler Dodge Jeep",contact:"",phone:"845 562 4100",email:"",address:"200 Auto Park Place, Newburgh, NY 12550",city:"Newburgh",state:"NY"},
];

export function mergeImportedCustomers(): number {
  const existing = getLocations();
  const existingCodes = new Set(existing.map((l) => l.code));
  let added = 0;

  for (const raw of IMPORTED) {
    if (existingCodes.has(raw.code)) continue;
    existingCodes.add(raw.code);

    const loc: LocationProfile = {
      id: generateId(),
      code: raw.code,
      name: raw.name,
      contactName: raw.contact,
      phone: raw.phone,
      email: raw.email,
      address: raw.address,
      notes: raw.city && raw.state ? `${raw.city}, ${raw.state}` : "",
    };
    existing.push(loc);
    added++;
  }

  if (added > 0) saveLocations(existing);
  return added;
}

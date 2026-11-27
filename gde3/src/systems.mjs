// Depositional systems as DATA (no code per system). Belts run proximal -> distal; w = relative width (the last belt is open-ended).
// adj: pairs of belts allowed to touch (symmetric). fringe: [beltA, beltB, f] = the boundary may interfinger, wobbling by up to
// f x the narrower of the two belts (f <= 0.3; must be a pair of adj). keyLines: [name, k] = the line sits on the boundary between belt k and k + 1.
// regimes (optional): parameter name, default, and per option a width multiplier per belt and fringe overrides ("a|b": f).
// refs status: published | memory | to verify | inference (a judgement of this page, not read in a source).
const chain = ids => ids.slice(1).map((id, i) => [ids[i], id]);
const B = (id, name, color, w, alias = []) => ({ id, name, color, w, alias });

export const SYSTEMS = {
  shoreface: {
    name: 'Wave-dominated shoreface–shelf (clastic)',
    belts: [B('plain', 'Coastal plain', '#b8c978', 1.6, ['coastal', 'alluvial plain', 'strandplain', 'continental', 'backbarrier']),
      B('shoreface', 'Shoreface', '#f3d955', 0.5, ['upper shoreface', 'lower shoreface', 'beach', 'foreshore', 'barrier island', 'swaley cross stratified sandstone']),
      B('transition', 'Offshore transition', '#cfe5c6', 0.8, ['transition zone', 'hcs sandstone', 'storm bed', 'tempestite', 'heterolithic shelf']),
      B('shelf', 'Offshore shelf', '#a9d3ec', 3, ['offshore', 'shelf', 'inner shelf', 'outer shelf', 'open shelf', 'shelf mudstone']),
      B('slope', 'Slope', '#6c9fcd', 1.1, ['continental slope', 'upper slope']),
      B('basin', 'Basin', '#3c6aa3', 2, ['basin floor', 'deep basin', 'deep marine'])],
    adj: chain(['plain', 'shoreface', 'transition', 'shelf', 'slope', 'basin']),
    fringe: [['shoreface', 'transition', 0.2], ['transition', 'shelf', 0.25]],
    keyLines: [['Shoreline', 0], ['Shelf edge', 3], ['Toe of slope', 4]],
    scale: { kmRange: [10, 300], km: 80 },
    refs: [
      { text: 'Walker & Plint (1992), Wave- and storm-dominated shallow marine systems, in Facies Models: Response to Sea Level Change, GAC (shoreface to offshore transition, HCS between fair-weather and storm wave base)', status: 'memory' },
      { text: 'Hallermeier (1980-81), Coastal Engineering 4, 253-277, doi:10.1016/0378-3839(80)90022-8 (shoreface limits, closure depths)', status: 'published' },
      { text: 'Shelf about 75 km wide, slope about 20 km (the widths 0.5 / 0.8 / 3 / 1.1 keep the shelf about 3.9 times the slope)', status: 'to verify' }]
  },
  delta: {
    name: 'Delta (river / wave / tide regimes)',
    belts: [B('plain', 'Delta plain', '#9fc46e', 3, ['upper delta plain', 'lower delta plain', 'distributary channel', 'interdistributary bay', 'crevasse splay']),
      B('front', 'Delta front', '#f3d34f', 1, ['mouth bar', 'delta front sand', 'distributary mouth bar']),
      B('prodelta', 'Prodelta', '#c8dcc0', 1.5, ['pro delta', 'prodelta mudstone']),
      B('shelf', 'Shelf', '#a9d3ec', 2.5, ['offshore shelf', 'offshore', 'open shelf', 'inner shelf']),
      B('slope', 'Slope', '#6c9fcd', 1.5, ['continental slope', 'upper slope']),
      B('basin', 'Basin', '#3c6aa3', 2, ['basin floor', 'deep basin', 'deep marine'])],
    adj: chain(['plain', 'front', 'prodelta', 'shelf', 'slope', 'basin']),
    fringe: [['plain', 'front', 0.15], ['front', 'prodelta', 0.15]],
    keyLines: [['Shoreline', 0], ['Shelf edge', 3], ['Toe of slope', 4]],
    regimes: {
      param: 'regime', default: 'river',
      options: {
        river: { widths: { front: 1, prodelta: 1.3 }, fringe: { 'plain|front': 0.3, 'front|prodelta': 0.3 } },
        wave: { widths: { plain: 0.8, front: 0.7, prodelta: 0.8 }, fringe: { 'plain|front': 0.05, 'front|prodelta': 0.1 } },
        tide: { widths: { front: 1.6, prodelta: 1 }, fringe: { 'plain|front': 0.25, 'front|prodelta': 0.2 } }
      },
      status: 'inference'
    },
    scale: { kmRange: [10, 300], km: 60 },
    refs: [
      { text: 'Galloway (1975), Process framework for describing the morphologic and stratigraphic evolution of deltaic depositional systems, in Deltas: Models for Exploration, Houston Geol. Soc. (river / wave / tide ternary)', status: 'to verify' },
      { text: 'Galloway & Hobday (1996), Terrigenous Clastic Depositional Systems, 2nd ed., Springer, doi:10.1007/978-3-642-61018-9', status: 'memory' },
      { text: 'Regime multipliers (front narrower and arcuate under waves, wider with tidal bars, more interfingering under river or tide supply): a judgement, to calibrate on a reference image', status: 'inference' }]
  },
  platform: {
    name: 'Rimmed carbonate platform',
    belts: [B('flat', 'Tidal flat / sabkha', '#d7c9a3', 1.2, ['supratidal', 'peritidal', 'intertidal flat', 'algal mat']),
      B('lagoon', 'Platform interior / lagoon', '#9edfd3', 4, ['restricted platform', 'inner platform', 'restricted lagoon', 'shelf lagoon']),
      B('open', 'Open platform / back-reef', '#b6e3c0', 1, ['back reef', 'backreef', 'open shelf', 'patch reef', 'skeletal sand']),
      B('margin', 'Platform margin (reef / shoal)', '#e98fb1', 0.25, ['shelf margin', 'barrier reef', 'oolite shoal', 'ooid shoal', 'margin', 'reef crest', 'shelf edge']),
      B('forereef', 'Fore-reef slope', '#64b3c7', 0.6, ['foreslope', 'fore reef', 'slope', 'reef talus', 'periplatform']),
      B('basin', 'Basin', '#3c6aa3', 2, ['basin floor', 'deep basin', 'basinal', 'pelagic'])],
    adj: chain(['flat', 'lagoon', 'open', 'margin', 'forereef', 'basin']),
    fringe: [['open', 'margin', 0.15]],
    keyLines: [['Shoreline', 0], ['Platform margin', 3], ['Toe of slope', 4]],
    scale: { kmRange: [10, 300], km: 60 },
    refs: [
      { text: 'Harris, Moore & Wilson (1985), Carbonate platforms, Colorado School of Mines Quarterly 80(4) (lagoon tens of km, open shelf 5-10 km, margin sand belt 1-2 km)', status: 'published' },
      { text: 'Wilson (1975), Carbonate Facies in Geologic History, Springer, doi:10.1007/978-1-4612-6383-8 (belts from basin to supratidal)', status: 'memory' }]
  }
};

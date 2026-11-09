import { parseTxtMetadata } from "../src/lib/parseTxt";

const sampleTxt = `created:20261106214010
photoID:d20261027151131
title:Mingus Mill
description:Mingus Mill is a 1886 grist mill with still-functional sluice, turbine, and other machinery. It is different from the other mills in the area as it uses a water-powered turbine instead of a water wheel to power the machinery. It is located in the Great Smoky Mountains National Park in North Carolina.
location:35.519967561465165,-83.3098807198084
month:10
day:27
year:2026
hour:15
minute:11
second:31
film:Digital
camera:Sony ILCE-7RM4
lens:Sony FE 4/24-105 G OSS
focalLength:24 mm
shutterspeed:1/15
aperture:f14
sensitivity:ISO 100
exposureCompensation:0 Ev
whiteBalance:4900 +12
toneCompensation:Auto
hueAdjustment:0
tripod:Manfrotto Befree GT XPRO Carbon, 496 ball head
availability:Available for Order
size:7896x5264
keyword:Mingus Mill,trees,Great Smoky Mountains National Park,Fall color,Fall,North Carolina,NC,color,vertical
category:Fall Color,Trees`;

const parsed = parseTxtMetadata(sampleTxt);
console.log("=== PARSER TEST RESULT ===");
console.log(JSON.stringify(parsed, null, 2));

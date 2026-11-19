"use strict";

function councilWorkbook(rows, filters){
 const spreadsheet="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
 const relationships="http://schemas.openxmlformats.org/officeDocument/2006/relationships";
 const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 const escapeXml=value=>String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,"").replace(/[&<>\r]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\r":"&#13;"}[ch]));
 const worksheet=(data,widths,filter)=>{
  const lastColumn=String.fromCharCode(64+widths.length);
  const cols=widths.map((width,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>').join("");
  const sheetRows=data.map((row,i)=>{
   const cells=row.map((value,j)=>{
    const address=String.fromCharCode(65+j)+(i+1);
    return typeof value==="number"
     ? '<c r="'+address+'"><v>'+value+'</v></c>'
     : '<c r="'+address+'" t="inlineStr"><is><t xml:space="preserve">'+escapeXml(value)+'</t></is></c>';
   }).join("");
   return '<row r="'+(i+1)+'">'+cells+'</row>';
  }).join("");
  const range='A1:'+lastColumn+data.length;
  const view=filter?'<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>':'';
  const autoFilter=filter?'<autoFilter ref="'+range+'"/>':'';
  return xml+'<worksheet xmlns="'+spreadsheet+'"><dimension ref="'+range+'"/>'+view+'<cols>'+cols+'</cols><sheetData>'+sheetRows+'</sheetData>'+autoFilter+'</worksheet>';
 };
 const rels=entries=>xml+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+entries.map(([type,target],i)=>'<Relationship Id="rId'+(i+1)+'" Type="'+relationships+'/'+type+'" Target="'+target+'"/>').join("")+'</Relationships>';
 const files={
  "[Content_Types].xml":xml+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
  "_rels/.rels":rels([["officeDocument","xl/workbook.xml"]]),
  "xl/workbook.xml":xml+'<workbook xmlns="'+spreadsheet+'" xmlns:r="'+relationships+'"><bookViews><workbookView/></bookViews><sheets><sheet name="Участь у радах" sheetId="1" r:id="rId1"/><sheet name="Фільтри" sheetId="2" r:id="rId2"/></sheets></workbook>',
  "xl/_rels/workbook.xml.rels":rels([["worksheet","worksheets/sheet1.xml"],["worksheet","worksheets/sheet2.xml"]]),
  "xl/worksheets/sheet1.xml":worksheet(rows,[46,16,16,21],true),
  "xl/worksheets/sheet2.xml":worksheet([["Параметр","Значення"],...filters],[25,65],false)
 };
 return councilWorkbookZip(files);
}

// XLSX packages are ZIP archives. Store the small XML files without compression.
function councilWorkbookZip(files){
 const encoder=new TextEncoder(), contents=[], directory=[];
 const header=(length,signature)=>{
  const bytes=new Uint8Array(length), view=new DataView(bytes.buffer);
  view.setUint32(0,signature,true);
  return {bytes,view};
 };
 const checksum=bytes=>{
  let crc=0xffffffff;
  for(const byte of bytes){
   crc^=byte;
   for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
 };
 const writeMetadata=(view,start,data,name,crc)=>{
  view.setUint16(start,20,true);
  view.setUint16(start+8,33,true);
  view.setUint32(start+10,crc,true);
  view.setUint32(start+14,data.length,true);
  view.setUint32(start+18,data.length,true);
  view.setUint16(start+22,name.length,true);
 };
 let offset=0,directoryLength=0;
 for(const [path,xml] of Object.entries(files)){
  const name=encoder.encode(path),data=encoder.encode(xml),crc=checksum(data);
  const local=header(30,0x04034b50),central=header(46,0x02014b50);
  writeMetadata(local.view,4,data,name,crc);
  central.view.setUint16(4,20,true);
  writeMetadata(central.view,6,data,name,crc);
  central.view.setUint32(42,offset,true);
  contents.push(local.bytes,name,data);
  directory.push(central.bytes,name);
  offset+=local.bytes.length+name.length+data.length;
  directoryLength+=central.bytes.length+name.length;
 }
 const end=header(22,0x06054b50), count=Object.keys(files).length;
 end.view.setUint16(8,count,true);
 end.view.setUint16(10,count,true);
 end.view.setUint32(12,directoryLength,true);
 end.view.setUint32(16,offset,true);
 return new Blob([...contents,...directory,end.bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

function downloadCouncilWorkbook(period,rows,filters){
 const link=document.createElement("a");
 link.href=URL.createObjectURL(councilWorkbook(rows,filters));
 link.download="uchast-u-radakh-"+period+".xlsx";
 document.body.append(link);
 link.click();
 link.remove();
 setTimeout(()=>URL.revokeObjectURL(link.href),60000);
}

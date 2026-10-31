/* SteamBusiness static website: browser-side data, no Power BI Service, no backend. */
'use strict';
const SOURCE_URLS = [
  'data/steam.csv',
  'https://raw.githubusercontent.com/jsngn/steam-machine-learning/master/steam.csv',
  'https://cdn.jsdelivr.net/gh/jsngn/steam-machine-learning@master/steam.csv'
];
const $ = (id) => document.getElementById(id);
const ESC = (s) => String(s ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const GENRE_VI = {'Action':'Hành động','Adventure':'Phiêu lưu','Indie':'Độc lập','Casual':'Giải trí nhẹ','Strategy':'Chiến thuật','RPG':'Nhập vai','Simulation':'Mô phỏng','Racing':'Đua xe','Sports':'Thể thao','Free to Play':'Chơi miễn phí','Early Access':'Truy cập sớm','Massively Multiplayer':'Nhiều người chơi trực tuyến','Violent':'Bạo lực','Gore':'Máu me','Animation & Modeling':'Hoạt hình và mô hình hóa','Design & Illustration':'Thiết kế và minh họa','Utilities':'Tiện ích','Education':'Giáo dục','Game Development':'Phát triển trò chơi'};
const PRICE_BANDS = ['Miễn phí','< £5','£5–9.99','£10–19.99','£20–29.99','£30–59.99','£60+'];
const COLORS = ['#1676c4','#32a6c6','#165493','#69bedc','#97d5e8','#2a8e7c','#8abedf','#9baada','#69a890'];
const TITLES = {
 overview:['Tổng quan kinh doanh','Quy mô, cấu trúc danh mục và xu hướng phát hành trò chơi.','TỔNG QUAN'],
 commercial:['Giá & thương mại','Đối chiếu nhóm giá, quy mô sở hữu ước tính và đánh giá tích cực.','GIÁ & THƯƠNG MẠI'],
 engagement:['Thị trường & tương tác','Quan sát đánh giá, lượt sở hữu và thời gian chơi trong tập trò chơi.','THỊ TRƯỜNG & TƯƠNG TÁC'],
 taxonomy:['Phân cấp danh mục','Đi sâu vào thể loại, phân khúc giá và đặc điểm danh mục.','DANH MỤC'],
 geography:['Bản đồ nhà phát hành','Phân bố quốc gia theo danh mục nhà phát hành được ánh xạ trong dự án.','ĐỊA LÝ NHÀ PHÁT HÀNH'],
 insights:['Kết quả phân tích','Đánh giá mức tập trung, phân khúc đáng khảo sát và giới hạn suy luận.','KẾT QUẢ PHÂN TÍCH'],
 countrydetail:['Chi tiết quốc gia','Phân tích chuyên sâu quốc gia nhà phát hành đang chọn.','CHI TIẾT QUỐC GIA']
};
const state={data:[],geo:null,active:'overview',filters:{from:'',to:'',genre:'',price:'',country:'',search:''},charts:[],source:'',taxonomyPath:{publisher:'',developer:''}};
const fInt = new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0});
const fDec = new Intl.NumberFormat('vi-VN',{maximumFractionDigits:1});
const fMoney = new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2});
const fmt=n=>fInt.format(Math.round(n||0));
const compact=n=>{if(!Number.isFinite(n))return '—';if(Math.abs(n)>=1e9)return fDec.format(n/1e9)+' tỷ';if(Math.abs(n)>=1e6)return fDec.format(n/1e6)+' triệu';if(Math.abs(n)>=1e3)return fDec.format(n/1e3)+' nghìn';return fmt(n)};
const pct=n=>Number.isFinite(n)?fDec.format(100*n)+'%':'—';
const priceText=n=>Number.isFinite(n)?fMoney.format(n):'—';
const safeNum=x=>{const n=Number(String(x??'').trim().replace(/,/g,''));return Number.isFinite(n)?n:0};
function csvParse(text){
 text=text.replace(/^\uFEFF/,'');const records=[];let row=[],field='',quotes=false;
 for(let i=0;i<text.length;i++){
   const ch=text[i];if(ch==='"'){if(quotes&&text[i+1]==='"'){field+='"';i++;}else quotes=!quotes;}
   else if(ch===','&&!quotes){row.push(field);field='';}
   else if((ch==='\n'||ch==='\r')&&!quotes){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x!==''))records.push(row);row=[];field='';}
   else field+=ch;
 }
 row.push(field);if(row.some(x=>x!==''))records.push(row);
 if(!records.length)return [];
 const header=records.shift().map(x=>x.trim().toLowerCase());
 return records.map(a=>Object.fromEntries(header.map((key,i)=>[key,a[i]??''])));
}
function readOwners(raw){
 const items=String(raw||'').match(/[\d,]+/g)||[];
 const lo=safeNum(items[0]||0),hi=safeNum(items[1]||items[0]||0);
 return [lo,hi,(lo+hi)/2];
}
function priceBand(n){if(n===null)return 'Chưa xác định';if(n===0)return 'Miễn phí';if(n<5)return '< £5';if(n<10)return '£5–9.99';if(n<20)return '£10–19.99';if(n<30)return '£20–29.99';if(n<60)return '£30–59.99';return '£60+';}
function parseGames(rows,mapping){
 if(!rows.length||!('name' in rows[0])||!('positive_ratings' in rows[0])||!('owners' in rows[0]))throw new Error('CSV không đúng cấu trúc Steam (name, owners, positive_ratings...).');
 const publisherMap=new Map(mapping.map(r=>[String(r['nhà phát hành khớp chính xác']||'').toLowerCase().trim(),{country:r['quốc gia']||'',region:r['khu vực']||''}]));
 const output=[];const ids=new Set();
 for(const r of rows){
  const id=String(r.appid||'').trim();if(ids.has(id))continue;ids.add(id);
  const [ownerLo,ownerHi,owners]=readOwners(r.owners);
  const match=(String(r.release_date||'').match(/(?:19|20)\d{2}/)||[])[0];
  const rawGenres=String(r.genres||'').split(/[;,|]/).map(s=>s.trim()).filter(Boolean);
  const primaryGenre=GENRE_VI[rawGenres[0]]||rawGenres[0]||'Chưa xác định';
  const genres=rawGenres.map(x=>GENRE_VI[x]||x);
  const publisher=String(r.publisher||'').trim()||'Chưa xác định';
  const primaryPublisher=publisher.split(';')[0].trim();
  const location=publisherMap.get(primaryPublisher.toLowerCase());
  const priceRaw=String(r.price??'').trim(),price=priceRaw===''?null:safeNum(priceRaw);
  const positive=safeNum(r.positive_ratings),negative=safeNum(r.negative_ratings);
  const developer=String(r.developer||'').trim()||'Chưa xác định';
  output.push({name:String(r.name||'').trim()||'(Chưa rõ tên trò chơi)',id,year:match?Number(match):0,
   genres,primaryGenre,publisher,primaryPublisher,developer,country:location?.country||'',region:location?.region||'',
   owners,ownerLo,ownerHi,price,band:priceBand(price),positive,negative,reviews:positive+negative,
   playtime:safeNum(r.median_playtime),avgPlaytime:safeNum(r.average_playtime),gross:(price||0)*owners});
 }
 return output;
}
function aggregate(rows){
 let owners=0,low=0,high=0,positive=0,reviews=0,gross=0,grossLo=0,grossHi=0,mapped=0,paidSum=0,paidCount=0,avgPlaySum=0;
 const paidPrices=[],playtimes=[],publisherSet=new Set(),developerSet=new Set();
 for(const d of rows){
  owners+=d.owners;low+=d.ownerLo;high+=d.ownerHi;positive+=d.positive;reviews+=d.reviews;
  gross+=(d.price||0)*d.owners;grossLo+=(d.price||0)*d.ownerLo;grossHi+=(d.price||0)*d.ownerHi;
  if(d.country)mapped++;if(d.price!==null&&d.price>0){paidSum+=d.price;paidCount++;paidPrices.push(d.price);}
  if(d.primaryPublisher&&d.primaryPublisher!=='Chưa xác định')publisherSet.add(d.primaryPublisher);
  if(d.developer)developerSet.add(d.developer);
  playtimes.push(d.playtime);avgPlaySum+=d.avgPlaytime;
 }
 const median=nums=>{const a=nums.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?(a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2:0};
 const top=rows.slice().sort((a,b)=>b.owners-a.owners).slice(0,10);
 return {count:rows.length,owners,low,high,positive,reviews,rate:reviews?positive/reviews:NaN,gross,grossLo,grossHi,
 avgPaid:paidCount?paidSum/paidCount:0,medianPaid:median(paidPrices),paidCount,freeCount:rows.filter(d=>d.price===0).length,
 mapped,coverage:rows.length?mapped/rows.length:0,medPlaytime:median(playtimes),avgPlaytime:rows.length?avgPlaySum/rows.length:0,
 publishers:publisherSet.size,developers:developerSet.size,medOwners:median(rows.map(x=>x.owners)),
 topShare:owners?top.reduce((sum,x)=>sum+x.owners,0)/owners:0,top};
}
function grouped(rows,key,limit=0){
 const m=new Map();for(const d of rows){const name=key==='genre'?d.primaryGenre:(d[key]||'Chưa xác định');
 if(!m.has(name))m.set(name,{name,count:0,owners:0,positive:0,reviews:0,price:0,playtime:0,gross:0,paidSum:0,paidCount:0});
 const a=m.get(name);a.count++;a.owners+=d.owners;a.positive+=d.positive;a.reviews+=d.reviews;
 a.price+=d.price||0;a.gross+=d.gross;a.playtime+=d.playtime;
 if(d.price!==null&&d.price>0){a.paidSum+=d.price;a.paidCount++;}
 }
 const list=[...m.values()].sort((a,b)=>b.count-a.count);return limit?list.slice(0,limit):list;
}
function groupYear(rows,field='count'){
 const m=new Map();for(const d of rows)if(d.year>=1990&&d.year<=2026)m.set(d.year,(m.get(d.year)||0)+(field==='owners'?d.owners:1));
 return [...m].sort((a,b)=>a[0]-b[0]);
}
function groupPrice(rows){return PRICE_BANDS.map(name=>{const a=rows.filter(d=>d.band===name),g=aggregate(a);return {name,...g};});}
function selectFiltered(){const f=state.filters;return state.data.filter(d=>(!f.from||d.year>=+f.from)&&(!f.to||d.year<=+f.to)&&(!f.genre||d.primaryGenre===f.genre)&&(!f.price||d.band===f.price)&&(!f.country||d.country===f.country)&&(!f.search||d.name.toLocaleLowerCase().includes(f.search.toLocaleLowerCase())));}
function fillSelect(id,options,first){const el=$(id),old=state.filters[id.replace('year-','')];el.innerHTML=`<option value="">${ESC(first)}</option>`+options.map(v=>`<option value="${ESC(v)}">${ESC(v)}</option>`).join(''); if(options.some(x=>String(x)===String(old)))el.value=old;}
function initFilters(){
 const years=[...new Set(state.data.map(x=>x.year).filter(x=>x>=1990&&x<=2026))].sort((a,b)=>a-b);
 fillSelect('year-from',years,'Từ đầu');fillSelect('year-to',years,'Đến cuối');
 const genres=[...new Set(state.data.map(x=>x.primaryGenre))].sort((a,b)=>a.localeCompare(b,'vi'));
 fillSelect('genre',genres,'Tất cả thể loại');fillSelect('price',PRICE_BANDS,'Tất cả mức giá');
 const countries=[...new Set(state.data.map(x=>x.country).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
 fillSelect('country',countries,'Tất cả quốc gia');
 for(const key of ['from','to','genre','price','country']){const id=key==='from'?'year-from':key==='to'?'year-to':key;$(id).value=state.filters[key]||'';}$('search').value=state.filters.search;
}
function setFilter(key,value){state.filters[key]=state.filters[key]===value?'':value;initFilters();render();}
function navPage(page){if(!(page in TITLES))page='overview';state.active=page;location.hash='#'+page;document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.page===page));const [title,desc,crumb]=TITLES[page];$('page-title').innerHTML=ESC(title)+'<span class="title-dot">.</span>';$('page-desc').textContent=desc;$('breadcrumb').textContent=crumb;render();window.scrollTo({top:0,behavior:'smooth'});}
function disposeCharts(){for(const chart of state.charts)chart.dispose();state.charts=[];}
function chart(id,opts,click){const el=$(id);if(!el||!window.echarts)return;const c=echarts.init(el,null,{renderer:'canvas'});c.setOption({...opts,animationDuration:400});if(click)c.on('click',click);state.charts.push(c);}
function baseOptions(){return {color:COLORS,textStyle:{fontFamily:'Inter, Segoe UI, sans-serif',color:'#446785'},grid:{top:25,left:45,right:18,bottom:42,containLabel:true},tooltip:{trigger:'axis',backgroundColor:'#173a65',borderWidth:0,textStyle:{color:'#fff',fontSize:11},axisPointer:{type:'shadow'}},axisPointer:{type:'shadow'}};}
function categoryChart(id,items,key,{horizontal=true,formatter=fmt,filterKey=null}={}){
 const values=horizontal?items.slice().reverse():items;
 const names=values.map(x=>x.name);const opt=baseOptions();opt.grid={top:20,left:horizontal?15:35,right:18,bottom:horizontal?20:63,containLabel:true};
 const axis={type:'category',data:names,axisLabel:{color:'#6e879f',fontSize:10,overflow:'truncate',width:horizontal?160:75,interval:0,rotate:horizontal?0:25},axisTick:{show:false},axisLine:{lineStyle:{color:'#e1ebf4'}}};
 const numeric={type:'value',axisLabel:{formatter:v=>compact(v),color:'#94a7b7',fontSize:10},splitLine:{lineStyle:{color:'#eef3f8'}},axisLine:{show:false}};
 opt.xAxis=horizontal?numeric:axis;opt.yAxis=horizontal?axis:numeric;opt.series=[{type:'bar',barMaxWidth:30,data:values.map(v=>v[key]),itemStyle:{borderRadius:horizontal?[0,6,6,0]:[6,6,0,0]},emphasis:{focus:'series'}}];
 opt.tooltip.formatter=p=>{const x=p[0];return `${ESC(x.name)}<br><b>${ESC(formatter(x.value))}</b>`};
 chart(id,opt,filterKey?p=>setFilter(filterKey,p.name):null);
}
function pieChart(id,items){const opt={color:COLORS,tooltip:{trigger:'item',formatter:p=>`${ESC(p.name)}: ${fmt(p.value)} trò chơi (${p.percent}%)`},legend:{bottom:0,type:'scroll',textStyle:{fontSize:10,color:'#67829a'}},series:[{type:'pie',radius:['52%','75%'],center:['50%','43%'],itemStyle:{borderColor:'#fff',borderWidth:3,borderRadius:6},label:{show:false},data:items.map(x=>({name:x.name,value:x.count}))}]};chart(id,opt,p=>setFilter('price',p.name));}
function lineChart(id,items){const opt=baseOptions();opt.tooltip.trigger='axis';opt.xAxis={type:'category',data:items.map(x=>x[0]),axisLabel:{color:'#72899f',fontSize:10,rotate:35},axisLine:{lineStyle:{color:'#e1ebf4'}}};opt.yAxis={type:'value',axisLabel:{formatter:compact,color:'#8ca3b6'},splitLine:{lineStyle:{color:'#eef4f9'}}};opt.series=[{type:'line',smooth:.28,showSymbol:false,data:items.map(x=>x[1]),lineStyle:{width:3},areaStyle:{opacity:.14},itemStyle:{color:COLORS[0]}}];chart(id,opt,p=>{const key=p.name;state.filters.from=String(key);state.filters.to=String(key);initFilters();render();});}
function scatterChart(id,rows,xKey,yKey,xLabel,yLabel,{limit=1100,click=false}={}){const sample=[];const step=Math.max(1,Math.floor(rows.length/limit));for(let i=0;i<rows.length;i+=step){const d=rows[i];if(!Number.isFinite(d[xKey])||!Number.isFinite(d[yKey]))continue;if(xKey==='price'&&d.price>160)continue;sample.push([d[xKey],d[yKey],d.name,d.reviews]);}
 const opt=baseOptions();opt.grid={top:16,left:45,right:23,bottom:56,containLabel:true};opt.tooltip={trigger:'item',backgroundColor:'#173a65',borderWidth:0,textStyle:{color:'#fff'},formatter:p=>`<b>${ESC(p.value[2])}</b><br>${ESC(xLabel)}: ${fDec.format(p.value[0])}<br>${ESC(yLabel)}: ${fDec.format(p.value[1])}`};opt.xAxis={type:'value',name:xLabel,nameLocation:'middle',nameGap:31,nameTextStyle:{fontSize:10,color:'#6c86a0'},axisLabel:{color:'#93a8b8',fontSize:10},splitLine:{lineStyle:{color:'#edf4fa'}}};opt.yAxis={type:'value',name:yLabel,nameGap:35,nameTextStyle:{fontSize:10,color:'#6c86a0'},axisLabel:{formatter:compact,color:'#93a8b8',fontSize:10},splitLine:{lineStyle:{color:'#edf4fa'}}};opt.series=[{type:'scatter',data:sample,symbolSize:7,itemStyle:{opacity:.43,color:'#218bc5'}}];chart(id,opt);}
function panel(title,subtitle,id,cls='half',h='chart',note=''){return `<article class="panel ${cls}"><h2>${ESC(title)}</h2><p class="panel-subtitle">${ESC(subtitle)}</p><div id="${id}" class="${h}"></div>${note?`<p class="panel-note">${ESC(note)}</p>`:''}</article>`;}
function tableHTML(cols,rows){return `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th${c.right?' class="numeric"':''}>${ESC(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((val,i)=>`<td${cols[i]?.right?' class="numeric"':''}>${val}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function rankTable(rows,n=10){return tableHTML([{label:'#'},{label:'TRÒ CHƠI'},{label:'THỂ LOẠI'},{label:'GIÁ',right:true},{label:'SỞ HỮU ƯỚC TÍNH',right:true}],rows.slice(0,n).map((r,i)=>[`<span class="rank">${i+1}</span>`,ESC(r.name),ESC(r.genres.slice(0,2).join(', ')||'Chưa rõ'),priceText(r.price),compact(r.owners)]));}
function metricsHTML(vals){return vals.map(x=>`<article class="metric"><div class="metric-label">${ESC(x[0])}</div><div class="metric-value">${ESC(x[1])}</div><div class="metric-foot">${ESC(x[2]||'')}</div></article>`).join('');}
function renderMetrics(rows,a){
 const shared=[['Số trò chơi',fmt(a.count),'Số mã trò chơi trong phạm vi lọc'],['Lượt sở hữu ước tính',compact(a.owners),'Tổng trung điểm khoảng sở hữu'],['Tỷ lệ đánh giá tích cực',pct(a.rate),'Tính theo tổng lượt đánh giá']];let metrics;
 switch(state.active){
 case'commercial':metrics=[['Giá trị gộp ước tính', '£'+compact(a.gross),'Không phải doanh thu'],['Cận dưới giá trị gộp','£'+compact(a.grossLo),'Giá × cận dưới sở hữu'],['Cận trên giá trị gộp','£'+compact(a.grossHi),'Giá × cận trên sở hữu'],['Trung vị giá trả phí','£'+priceText(a.medianPaid),'Chỉ trò chơi giá > 0']];break;
 case'engagement':metrics=[shared[2],['Trung vị thời gian chơi',fDec.format(a.medPlaytime/60)+' giờ','Trung vị các trung vị trò chơi'],['Thời gian chơi TB',fDec.format(a.avgPlaytime/60)+' giờ','TB thời gian chơi của trò chơi'],['Tổng lượt đánh giá',compact(a.reviews),'Tích cực + tiêu cực']];break;
 case'taxonomy':metrics=[['Số nhà phát hành',fmt(a.publishers),'Tên nhà phát hành đầu tiên'],['Số nhà phát triển',fmt(a.developers),'Tên đơn vị phát triển'],shared[0],shared[1]];break;
 case'geography':metrics=[shared[0],['Sở hữu đã ánh xạ',compact(rows.filter(d=>d.country).reduce((v,d)=>v+d.owners,0)),'Theo nhà phát hành'],['Độ bao phủ địa lý',pct(getGeoCoverage()),'Không phụ thuộc lọc quốc gia'],['Quốc gia đang chọn',state.filters.country||'Tất cả','Chọn trên bản đồ hoặc danh sách']];break;
 case'countrydetail':metrics=[['Quốc gia',state.filters.country||'Chưa chọn','Nhà phát hành đầu tiên'],shared[0],shared[1],shared[2]];break;
 case'insights':metrics=[['Tỷ trọng 10 trò chơi đầu',pct(a.topShare),'Trong tập lọc hiện tại'],['Sở hữu trung vị/trò chơi',compact(a.medOwners),'Trung vị trung điểm sở hữu'],['Giá trung vị trả phí','£'+priceText(a.medianPaid),'Chỉ trò chơi trả phí'],shared[2]];break;
 default:metrics=[shared[0],shared[1],shared[2],['Giá trị gộp ước tính','£'+compact(a.gross),'Giá × lượt sở hữu; không phải doanh thu']];
 }
 $('metric-grid').innerHTML=metricsHTML(metrics);
}
function getGeoCoverage(){const f={...state.filters};let total=0,mapped=0;for(const d of state.data){if((!f.from||d.year>=+f.from)&&(!f.to||d.year<=+f.to)&&(!f.genre||d.primaryGenre===f.genre)&&(!f.price||d.band===f.price)&&(!f.search||d.name.toLowerCase().includes(f.search.toLowerCase()))){total++;if(d.country)mapped++;}}return total?mapped/total:NaN;}

function renderOverview(rows,a){
 const gs=grouped(rows,'genre',10),byYear=groupYear(rows),top=a.top;
 $('page-body').innerHTML=panel('Số trò chơi theo thể loại chính','Mỗi trò chơi chỉ tính một thể loại chính, như mô hình Power BI. Nhấp thanh để lọc.','genresChart','half')+
 panel('Số lượng phát hành theo năm','Năm phát hành không phải năm doanh thu. Nhấp điểm để lọc năm.','yearChart','half')+
 `<article class="panel wide"><h2>Danh sách trò chơi nổi bật</h2><p class="panel-subtitle">Sắp xếp theo lượt sở hữu ước tính · dữ liệu lịch sử.</p>${rankTable(top)}</article>`;
 categoryChart('genresChart',gs,'count',{filterKey:'genre'});lineChart('yearChart',byYear);
}
function renderCommercial(rows,a){
 const bands=groupPrice(rows),genres=grouped(rows,'genre').sort((a,b)=>b.gross-a.gross).slice(0,12),publishers=grouped(rows,'publisher').sort((a,b)=>b.gross-a.gross).slice(0,12);
 $('page-body').innerHTML=`<div class="info-box"><b>Đơn vị: GBP.</b> Giá trị gộp = giá quan sát × lượt sở hữu ước tính, KHÔNG phải doanh thu thực tế hoặc lợi nhuận.</div>`+
 panel('Trò chơi theo nhóm giá','Ngưỡng nhóm giá sao chép theo mô hình PBIP gốc.','priceDistribution','half')+
 panel('Giá trị gộp theo thể loại chính','Không phải doanh thu · nhấp thanh để lọc.','genreGross','half')+
 `<article class="panel wide"><h2>Nhà phát hành và giá trị gộp</h2><p class="panel-subtitle">Top 12 nhà phát hành theo giá trị gộp ước tính (GBP).</p>${tableHTML([{label:'NHÀ PHÁT HÀNH'},{label:'TRÒ CHƠI',right:true},{label:'LƯỢT SỞ HỮU',right:true},{label:'GIÁ TRỊ GỘP',right:true},{label:'TỶ LỆ TÍCH CỰC',right:true}],publishers.map(d=>[ESC(d.name),fmt(d.count),compact(d.owners),'£'+compact(d.gross),pct(d.reviews?d.positive/d.reviews:NaN)]))}</article>`;
 categoryChart('priceDistribution',bands,'count',{horizontal:false,filterKey:'price'});
 categoryChart('genreGross',genres,'gross',{formatter:x=>'£'+compact(x),filterKey:'genre'});
}
function renderEngagement(rows,a){
 const genres=grouped(rows,'genre').sort((a,b)=>b.owners-a.owners).slice(0,12),years=groupYear(rows,'owners');
 const top=rows.slice().sort((x,y)=>y.reviews-x.reviews).slice(0,15);
 $('page-body').innerHTML=panel('Lượt sở hữu ước tính theo thể loại chính','Nhấp thanh để lọc · tổng trung điểm khoảng sở hữu.','genreOwners','half')+
 panel('Lượt sở hữu theo năm phát hành','Không thể suy ra tăng trưởng doanh thu theo năm.','yearOwners','half')+
 `<article class="panel wide"><h2>Trò chơi theo tổng lượt đánh giá</h2><p class="panel-subtitle">Số liệu đánh giá lịch sử; có thể sắp xếp lại khi thay đổi bộ lọc.</p>${tableHTML([{label:'TRÒ CHƠI'},{label:'NHÀ PHÁT HÀNH'},{label:'ĐÁNH GIÁ',right:true},{label:'TÍCH CỰC',right:true},{label:'SỞ HỮU ƯỚC TÍNH',right:true},{label:'TRUNG VỊ CHƠI (PHÚT)',right:true}],top.map(d=>[ESC(d.name),ESC(d.primaryPublisher),fmt(d.reviews),pct(d.reviews?d.positive/d.reviews:NaN),compact(d.owners),fmt(d.playtime)]))}</article>`;
 categoryChart('genreOwners',genres,'owners',{formatter:compact,filterKey:'genre'});
 lineChart('yearOwners',years);
}
function renderTaxonomy(rows,a){
 const path=state.taxonomyPath;
 const filtered=rows.filter(d=>(!path.publisher||d.publisher===path.publisher)&&(!path.developer||d.developer===path.developer));
 const listKey=!path.publisher?'publisher':!path.developer?'developer':'name';
 const aggregateBy=grouped(filtered,listKey).sort((x,y)=>y.owners-x.owners).slice(0,15);
 const actions=`<div class="drill-header"><button type="button" class="drill" data-drill="root">Tất cả nhà phát hành</button>${path.publisher?`<span>›</span><button type="button" class="drill" data-drill="publisher">${ESC(path.publisher)}</button>`:''}${path.developer?`<span>›</span><b>${ESC(path.developer)}</b>`:''}</div>`;
 $('page-body').innerHTML=`<div class="info-box"><b>Phân cấp đúng theo Power BI:</b> Nhà phát hành → Nhà phát triển → Trò chơi. Chọn thanh để đi xuống một cấp; dùng đường dẫn để quay lại.</div>`+
 `<article class="panel wide">${actions}<h2>${!path.publisher?'Nhà phát hành':!path.developer?'Nhà phát triển thuộc '+ESC(path.publisher):'Trò chơi của '+ESC(path.developer)}</h2><p class="panel-subtitle">Xếp theo lượt sở hữu ước tính trong phạm vi lọc.</p><div id="hierarchyChart" class="chart tall"></div></article>`+
 `<article class="panel wide"><h2>Chi tiết phân cấp</h2><p class="panel-subtitle">${fmt(filtered.length)} trò chơi trong cấp đã chọn.</p>${tableHTML([{label:'NHÀ PHÁT HÀNH'},{label:'NHÀ PHÁT TRIỂN'},{label:'TRÒ CHƠI'},{label:'NĂM',right:true},{label:'GIÁ (£)',right:true},{label:'LƯỢT SỞ HỮU',right:true}],filtered.slice().sort((x,y)=>y.owners-x.owners).slice(0,40).map(d=>[ESC(d.publisher),ESC(d.developer),ESC(d.name),d.year||'—',priceText(d.price),compact(d.owners)]))}</article>`;
 categoryChart('hierarchyChart',aggregateBy,'owners',{formatter:compact});
 const c=state.charts[state.charts.length-1];if(c&&listKey!=='name')c.on('click',param=>{if(listKey==='publisher'){state.taxonomyPath={publisher:param.name,developer:''};}else if(listKey==='developer'){state.taxonomyPath.developer=param.name;}render();});
 $('page-body').querySelectorAll('[data-drill]').forEach(el=>el.addEventListener('click',()=>{if(el.dataset.drill==='root')state.taxonomyPath={publisher:'',developer:''};else state.taxonomyPath.developer='';render();}));
}
function renderGeography(rows,a){
 const country=grouped(rows.filter(d=>d.country),'country').sort((x,y)=>y.owners-x.owners),mappedOwners=country.reduce((s,d)=>s+d.owners,0);
 const coverage=getGeoCoverage();
 $('page-body').innerHTML=`<div class="info-box"><b>Giới hạn địa lý:</b> Quốc gia được gán theo tên nhà phát hành đầu tiên khớp chính xác, không phải nơi sống của người chơi. Mức bao phủ không phụ thuộc bộ lọc quốc gia.</div>`+
 panel('Bản đồ quốc gia nhà phát hành','Nhấn quốc gia có dữ liệu để lọc · rê chuột xem số trò chơi và lượt sở hữu.','publisherMap','wide','chart mapchart')+
 panel('Lượt sở hữu theo quốc gia đã ánh xạ','Nhấp thanh để lọc ngược bản đồ.','countryChart','half')+
 `<article class="panel half"><h2>Chất lượng ánh xạ địa lý</h2><p class="panel-subtitle">Nguồn ánh xạ bảo thủ, cần xác minh nguồn trụ sở trước khi kết luận học thuật.</p><div class="mini-stat"><strong>${pct(coverage)}</strong><span>Độ bao phủ không phụ thuộc quốc gia đang chọn</span></div><div class="mini-stat"><strong>${compact(mappedOwners)}</strong><span>Lượt sở hữu ước tính đã ánh xạ trong tập lọc</span></div><div class="mini-stat"><strong>${state.filters.country?ESC(state.filters.country):'Chưa chọn'}</strong><span>Quốc gia đang chọn</span></div>${state.filters.country?'<button id="open-country-detail" type="button" class="primary-button">Xem chi tiết quốc gia ↗</button>':''}</article>`;
 if(state.geo&&window.echarts){
  echarts.registerMap('steamWorld',state.geo);const countryMap=new Map(country.map(x=>[x.name,x]));
  const opt={visualMap:{min:0,max:Math.max(1,...country.map(x=>x.owners)),left:14,bottom:18,calculable:false,text:['Nhiều','Ít'],inRange:{color:['#def3fd','#83c6e3','#1268ae']},textStyle:{color:'#69869c',fontSize:10}},
   tooltip:{trigger:'item',formatter:p=>{const d=countryMap.get(p.name);return `<b>${ESC(p.name)}</b><br>${d?fmt(d.count)+' trò chơi<br>'+compact(d.owners)+' lượt sở hữu<br>'+pct(d.reviews?d.positive/d.reviews:NaN)+' tích cực':'Chưa ánh xạ'}`}},
   series:[{type:'map',map:'steamWorld',roam:true,zoom:1.1,scaleLimit:{min:1,max:5},itemStyle:{areaColor:'#e4edf5',borderColor:'#fff',borderWidth:.6},emphasis:{label:{show:false},itemStyle:{areaColor:'#53b4e0'}},select:{itemStyle:{areaColor:'#f5b67a'}},data:country.map(x=>({name:x.name,value:x.owners}))}]};
  chart('publisherMap',opt,p=>{if(countryMap.has(p.name))setFilter('country',p.name)});
 }
 categoryChart('countryChart',country.slice(0,18),'owners',{formatter:compact,filterKey:'country'});
 if($('open-country-detail'))$('open-country-detail').addEventListener('click',()=>navPage('countrydetail'));
}
function renderCountryDetail(rows,a){
 if(!state.filters.country){$('page-body').innerHTML='<div class="info-box">Chọn một quốc gia ở trang bản đồ trước khi mở chi tiết.</div><button type="button" class="primary-button" id="back-map">← Về bản đồ</button>';$('back-map').onclick=()=>navPage('geography');return;}
 const publisher=grouped(rows,'primaryPublisher').sort((x,y)=>y.owners-x.owners).slice(0,14),genres=grouped(rows,'genre').sort((x,y)=>y.owners-x.owners).slice(0,12),years=groupYear(rows,'owners');
 $('page-body').innerHTML=`<button type="button" class="quiet-button" id="back-map">← Quay lại bản đồ</button><div class="info-box"><b>${ESC(state.filters.country)}</b> là quốc gia nhà phát hành đã ánh xạ, không phải địa lý của người chơi.</div>`+
 panel('Top nhà phát hành','Theo lượt sở hữu ước tính.','detailPublishers','half')+panel('Thể loại nổi bật','Phân loại theo thể loại chính.','detailGenres','half')+
 panel('Lượt sở hữu theo năm phát hành','Năm phát hành của trò chơi.','detailYears','wide')+
 `<article class="panel wide"><h2>Trò chơi trong quốc gia</h2><p class="panel-subtitle">Các trò chơi nhà phát hành được ánh xạ đến quốc gia đang chọn.</p>${rankTable(rows.slice().sort((x,y)=>y.owners-x.owners),25)}</article>`;
 $('back-map').onclick=()=>navPage('geography');
 categoryChart('detailPublishers',publisher,'owners',{formatter:compact});categoryChart('detailGenres',genres,'owners',{formatter:compact,filterKey:'genre'});lineChart('detailYears',years);
}
function renderInsights(rows,a){
 const genres=grouped(rows,'genre').sort((x,y)=>y.owners-x.owners).slice(0,12),top=a.top;
 const lead=genres[0],positiveTop=genres.filter(g=>g.reviews>=100).slice().sort((a,b)=>b.positive/b.reviews-a.positive/a.reviews)[0];
 const rateGenres=genres.map(d=>({...d,rate:d.reviews?100*d.positive/d.reviews:0}));
 $('page-body').innerHTML=`<div class="info-box">Đây là gợi ý diễn giải bộ dữ liệu Steam lịch sử (~2019), không phải khuyến nghị đầu tư dựa trên doanh thu thực tế.</div>`+
 `<article class="panel half"><h2>Phát hiện trong phạm vi chọn</h2><p class="panel-subtitle">Tự động cập nhật theo bộ lọc đang sử dụng.</p><ul class="insight-list"><li><b>Tập trung:</b> 10 trò chơi có nhiều lượt sở hữu nhất chiếm ${pct(a.topShare)}.<span>Đây là tỷ trọng quan sát, không phải ngưỡng rủi ro.</span></li><li><b>Thể loại dẫn đầu:</b> ${ESC(lead?.name||'Không có')} — ${compact(lead?.owners||0)} lượt sở hữu.<span>Thể loại chính, không cộng chồng nhiều thể loại.</span></li><li><b>Đánh giá tích cực:</b> ${ESC(positiveTop?.name||'Chưa đủ dữ liệu')} (${pct(positiveTop?positiveTop.positive/positiveTop.reviews:NaN)}).<span>Trong các nhóm ít nhất 100 lượt đánh giá.</span></li><li><b>Giá trung vị trả phí:</b> £${priceText(a.medianPaid)}.<span>Không dùng giá × sở hữu để khẳng định doanh thu.</span></li></ul></article>`+
 panel('Lượt sở hữu theo thể loại chính','Nhấp thanh để lọc toàn báo cáo.','insightOwners','half')+
 panel('Tỷ lệ tích cực theo thể loại chính','Tính theo trọng số lượt đánh giá.','insightApproval','half')+
 `<article class="panel half"><h2>10 trò chơi dẫn đầu</h2><p class="panel-subtitle">Đại diện sự tập trung danh mục.</p>${rankTable(top)}</article>`;
 categoryChart('insightOwners',genres,'owners',{formatter:compact,filterKey:'genre'});
 categoryChart('insightApproval',rateGenres,'rate',{formatter:x=>fDec.format(x)+'%',filterKey:'genre'});
}
function render(){
 disposeCharts();const body=$('page-body');
 if(!state.data.length){$('metric-grid').innerHTML=metricsHTML([['Số trò chơi','—','Đang chờ dữ liệu'],['Lượt sở hữu','—','Chưa có dữ liệu'],['Đánh giá tích cực','—','Chưa có dữ liệu'],['Giá trung bình','—','Chưa có dữ liệu']]);body.innerHTML='<div class="loading-block"><div class="loading-circle"></div><b>Đang chờ tải dữ liệu Steam...</b><p>Dữ liệu đang được tải tự động từ nguồn công khai.</p></div>';return;}
 if(!window.echarts){body.innerHTML='<div class="loading-block"><b>Không tải được ECharts.</b><p>Kiểm tra kết nối Internet hoặc CDN, rồi tải lại trang.</p></div>';return;}
 const rows=selectFiltered(),a=aggregate(rows);
 $('filter-summary').textContent=`${fmt(rows.length)} / ${fmt(state.data.length)} trò chơi trong phạm vi lọc`;
 renderMetrics(rows,a);
 if(!rows.length){body.innerHTML='<div class="loading-block"><b>Không có trò chơi phù hợp.</b><p>Điều chỉnh các bộ lọc hoặc chọn Đặt lại.</p></div>';return;}
 switch(state.active){case'overview':renderOverview(rows,a);break;case'commercial':renderCommercial(rows,a);break;case'engagement':renderEngagement(rows,a);break;case'taxonomy':renderTaxonomy(rows,a);break;case'geography':renderGeography(rows,a);break;case'countrydetail':renderCountryDetail(rows,a);break;case'insights':renderInsights(rows,a);break;}
}
async function loadCsvText(text,source){const rows=csvParse(text);const mappingText=await (await fetch('data/publisher_mapping.csv')).text();const mapping=csvParse(mappingText);const games=parseGames(rows,mapping);if(!games.length)throw new Error('File CSV không có bản ghi hợp lệ.');state.data=games;state.source=source;state.filters={from:'',to:'',genre:'',price:'',country:'',search:''};state.taxonomyPath={publisher:'',developer:''};$('data-warning').hidden=true;$('source-status').textContent=`${fmt(games.length)} trò chơi đã nạp`;initFilters();render();}
async function fetchData(){for(const url of SOURCE_URLS){try{const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),17000);let response;try{response=await fetch(url,{signal:controller.signal,cache:'default'});}finally{clearTimeout(timeout);}if(!response.ok)throw new Error('HTTP '+response.status);const text=await response.text();await loadCsvText(text,'Nguồn công khai: '+url);return;}catch(err){console.warn('Nguồn không tải được:',url,err);}}
 $('data-warning').hidden=false;$('error-message').textContent='Không thể tải dữ liệu Steam tự động. Vui lòng tải lại trang để thử lại. Website không sử dụng số liệu giả khi thiếu dữ liệu.';$('source-status').textContent='Chưa có dữ liệu';}
function setup(){document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>navPage(el.dataset.page)));
 for(const [id,key] of [['year-from','from'],['year-to','to'],['genre','genre'],['price','price'],['country','country']])$(id).addEventListener('change',()=>{state.filters[key]=$(id).value;render();});
 $('search').addEventListener('input',()=>{state.filters.search=$('search').value.trim();render();});
 $('reset').addEventListener('click',()=>{state.filters={from:'',to:'',genre:'',price:'',country:'',search:''};state.taxonomyPath={publisher:'',developer:''};initFilters();render();});
 window.addEventListener('resize',()=>state.charts.forEach(c=>c.resize()));
 window.addEventListener('hashchange',()=>{const p=location.hash.slice(1);if(TITLES[p]&&p!==state.active)navPage(p)});
 try{const start=location.hash.slice(1);if(TITLES[start])navPage(start);else navPage('overview');}catch(e){console.error(e);}
 Promise.all([fetch('data/world.geojson').then(r=>r.ok?r.json():null).catch(()=>null),fetchData()]).then(([geo])=>{state.geo=geo;if(state.data.length&&state.active==='geography')render();});
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',setup);

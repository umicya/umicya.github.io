try {const saved=localStorage.getItem('qinglan-domain-v2');if(saved)Village.setDomain(JSON.parse(saved));} catch {}
renderUI();
function frame(t){const dt=Math.min(.08,(t-(frame.last||t))/1000);frame.last=t;elapsed+=dt;V.update(dt);draw();if(t-lastUI>350){renderUI();lastUI=t}requestAnimationFrame(frame)}
requestAnimationFrame(frame);

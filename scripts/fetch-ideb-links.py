import urllib.request
import re
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    print('Baixando pagina HTML do INEP...')
    html = urllib.request.urlopen(req, context=ctx, timeout=15).read().decode('utf-8')
    links = set(re.findall(r'https?://[a-zA-Z0-9.\-\_/]+(?:\.zip|\.xlsx?|\.rar)', html, re.I))
    print(f'Encontrados {len(links)} links de arquivos na pagina:')
    for l in sorted(list(links)):
        if 'municip' in l.lower() or 'ideb' in l.lower() or 'iniciai' in l.lower() or 'finais' in l.lower():
            print(f" -> {l}")
except Exception as e:
    print('Erro:', e)

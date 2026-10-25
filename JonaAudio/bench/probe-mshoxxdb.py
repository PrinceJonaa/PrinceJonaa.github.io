#!/usr/bin/env python3
"""Inspect mshoxxDB v1.1 full-song ZIP via bounded HTTP Range (no audio transfer)."""
from pathlib import Path
from remotezip import RemoteZip
SOURCE='https://zenodo.org/records/15881577/files/mshoxxDB_v1.1.zip?download=1'
def main():
 with RemoteZip(SOURCE,timeout=140) as archive:
  members=archive.infolist()
  print('Complete-song dataset ZIP entries',len(members),flush=True)
  print('ZIP paths first 30',[(x.filename,x.file_size) for x in members[:30]],flush=True)
  meta=[m for m in members if m.filename.lower().endswith(('.csv','.json','.md','.txt')) and m.file_size<300000]
  print('Metadata paths',[(m.filename,m.file_size) for m in meta[:25]],flush=True)
  print('Source dataset README:',archive.read('README.txt').decode('utf-8-sig','replace')[:6500],flush=True)
  for member in meta[:5]:
   data=archive.read(member.filename)
   print('METADATA EXCERPT',member.filename,data[:2000].decode('utf-8-sig','replace'),flush=True)
  files=[m for m in members if m.filename.lower().endswith('.flac')]
  print('FLAC audio count and sample paths',len(files),[(x.filename,x.file_size) for x in files[:20]],flush=True)
if __name__=='__main__':main()

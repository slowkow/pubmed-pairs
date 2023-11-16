/* main.js
 *
 * Author: Kamil Slowikowski
 * Date: 2023-09-18
 * License: MIT
 *
 * Live demo: https://slowkow.com/pubmed-pairs
 *
 * Source code: https://github.com/slowkow/pubmed-pairs
 *
 * This script main.js supports a one page HTML app that enables us to count
 * how many papers we can find on PubMed for each pair of search terms from two
 * lists of search terms.
 *
 * Let's say our first list is: bacteria, virus
 *
 * And our second list is: IL6, IL8
 *
 * Then, pubmed-pairs will search PubMed for all possible pairs:
 *
 * 1. bacteria IL6
 * 2. bacteria IL8
 * 3. virus IL6
 * 4. virus IL6
 *
 */


var g_table_length = 0
var g_build_table_first = true

var cache_count_papers = {}
var cache_get_papers = {}

const timer = ms => new Promise(res => setTimeout(res, ms))

function pairs(first, second) {
  var pairs = []
  for (const x of first) {
    for (const y of second) {
      pairs.push(`${x} ${y}`)
    }
  }
  return pairs
}

async function count_papers(first, second) {
  const term = `${first} ${second}`
  if (term in cache_count_papers) {
    resp = cache_count_papers[term]
  } else {
    await timer(1000)
    // const first = 'tocilizumab'
    // const second = 'HLA-DQA1'
    var resp = await (async function() {
      const queryParams = {
        email: 'kslowikowski@gmail.com',
        usehistory: 'n', db: 'pubmed', term: term, retmode: 'json',
        sort: 'relevance'
      }
      const queryString = new URLSearchParams(queryParams).toString()
      console.log(`eutils/esearch.fcgi?${queryString}`)
      return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${queryString}`)
        .then((response) => {
          return response.json()
        })
    })()
    cache_count_papers[term] = resp
  }
  return +resp.esearchresult.count
}

async function get_papers(first, second) {
  const term = `${first} ${second}`
  if (term in cache_get_papers) {
    text = cache_get_papers[term]
  } else {
    var text = await (async function() {
      const queryParams = {
        email: 'kslowikowski@gmail.com',
        usehistory: 'y', db: 'pubmed', term: term, retmode: 'json',
        sort: 'relevance'
      }
      const queryString = new URLSearchParams(queryParams).toString()
      return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${queryString}`)
        .then((response) => {
          return response.json()
        })
        .then(async (d) => {
          const pubmed_ids = d.esearchresult.idlist
          const queryString = new URLSearchParams({
            WebEnv: d.esearchresult.webenv,
            db: 'pubmed',
            rettype: 'abstract',
            retmode: 'text',
            id: Array.prototype.join.call(pubmed_ids)
          }).toString()
          return await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${queryString}`)
            .then((response) => {
              return response.text()
          })
        })
    })()
  }
  return text.split(/\n\s*\n\s*\n/).map((p) => {
    const items = p.split(/\n\s*\n/)
    const doi = items.find(value => /PMID/.test(value))
    const pmid = doi.match(/PMID: (\d+)/)[1]
    return {
      year: items[0].match(/\d{4}/)[0] + '-01-01',
      journal: items[0],
      title: items[1],
      authors: items[2],
      institutions: items[3],
      abstract: items[4],
      pmid: pmid
    }
  })
}

async function build_table(data) {
  var head = `<tr class="striped--near-white">
    <th class="pv2 ph3">Pair</th>
    <th class="pv2 ph3">Query</th>
    <th class="pv2 ph3">Results</th>
    <th class="pv2 ph3">View results on PubMed</th>
  </tr>`
  var rows = [head]
  var i = 0
  for (const d of data) {
    i++
    var count = `<span class="hits" id="${d.pair}">${d.count}</span>`
    if (d.count == 0) {
      count = `<span class="mid-gray" id="${d.pair}">${d.count}</span>`
    }
    var link = `<a target="_blank" rel="noopener noreferrer" class="link" href="https://pubmed.ncbi.nlm.nih.gov/?term=${d.pair}">pubmed</a>`
    rows.push(`<tr class="striped--near-white">
      <td class="pv2 ph3">${i}</td>
      <td class="pv2 ph3">${d.pair}</td>
      <td class="pv2 ph3">${count}</td>
      <td class="pv2 ph3">${link}</td>
    </tr>`)
  }
  while (i++ < g_table_length) {
    rows.push(`<tr class="striped--near-white">
      <td class="pv2 ph3">${i}</td>
      <td class="pv2 ph3"> </td>
      <td class="pv2 ph3"> </td>
      <td class="pv2 ph3"> </td>
    </tr>`)
  }
  var table = `<table class="collapse ba br2 b--black-10 pv2 ph3 mt4">
    <tbody>${rows.join('')}</tbody>
  </table>`
  document.getElementById("table").innerHTML = table
  for (const d of data) {
    if (g_build_table_first && d.count > 0) {
      g_build_table_first = false
      const papers = await get_papers(d.first, d.second)
      build_papers(papers, `${d.first}, ${d.second}`)
    }
    var el = document.getElementById(d.pair)
    el.onclick = async function() {
      const papers = await get_papers(d.first, d.second)
      build_papers(papers, `${d.first}, ${d.second}`)
    }
  }
}

function build_papers(papers, title) {
  const papers_title = document.getElementById("papers-title")
  papers_title.innerText = title
  const papers_div = document.getElementById("papers")
  var rows = []
  for (const p of papers) {
    var html = `<article class="pv1">
        <div class="flex flex-row">
          <div class="w-100">
            <p class="f5 fw5 lh-title mv0"><a target="_blank" rel="noopener noreferrer" class="link" href="https://pubmed.ncbi.nlm.nih.gov/${p.pmid}">${p.title}</a></p>
            <p class="f7 lh-copy mv0">${p.authors}</p>
            <p class="f7 lh-copy mv0">${p.journal.substr(3)}</p>
            <p class="f7 lh-copy mv0">PMID: <span class="pmid">${p.pmid}</span></p>
            <p class="f7 lh-copy">${p.abstract.substr(0, 300)}<span class="dots"> (show more)</span><span class="more">${p.abstract.substr(300)}</span></p>
          </div>
        </div>
      </article>`
    rows.push(html)
  }
  var my_html = rows.join('\n')
  // use regex to highlight matches (allowing hyphens like "IL6" and "IL-6")
  for (const search of title.split(', ')) {
    const search2 = search.split('').join('-?').trim()
    const regex = new RegExp(`(${search2})`, "ig")
    my_html = my_html.replace(regex, '<span class="searchterm">$1</span>')
  }
  papers_div.innerHTML = my_html
  const dots = document.getElementsByClassName("dots")
  for (const dot of dots) {
    dot.onclick = function() {
      dot.nextElementSibling.style.display = 'inline'
      dot.style.display = 'none'
    }
  }
}

async function click_search() {
  var retval = []
  const first = document.getElementById("first").value.split(/[,;\r\n]+/)
  const second = document.getElementById("second").value.split(/[,;\r\n]+/)
  const ps = pairs(first, second)
  g_table_length = ps.length
  const info =  document.getElementById("info")
  info.innerText = `${ps.length} pairs: ${ps.join(', ')}`
  for (const x of first) {
    for (const y of second) {
      const n = await count_papers(x, y)
      retval.push({
        'pair': `${x} ${y}`, 'first': x, 'second': y, 'count': n
      })
      build_table(retval)
    }
  }
  return retval
}

const search = document.getElementById("search-button")
search.onclick = async function() {
  const data = await click_search()
  build_table(data)
}


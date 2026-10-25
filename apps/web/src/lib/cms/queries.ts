import { defineQuery } from 'groq';

// One consistent snapshot per request; references are resolved here, never duplicated in page content.
export const SITE_CONTENT_QUERY = defineQuery(`{
  "settings": *[_type == "siteSettings" && _id == "siteSettings"][0]{brand,tagline,phone,email,linkedin,footerText,contactText,qualification{status,label,registration,"personId":person->_id}},
  "home": *[_type == "homePage" && _id == "homePage"][0]{
    eyebrow,title,intro,primaryCta,secondaryCta,statisticsTitle,statisticsTransition,
    "statistics": statistics[]->[_type == "statistic" && verified == true]{_id,value,label,source,sourceUrl,year,note,verified},
    diagnostic{...,image{...,asset->{_id,url,metadata{dimensions,lqip}}}},reasons,reasonsTitle,domainsTitle,domainsIntro,conviction,closingTitle,closingCta,editorial,seo
  },
  "pages": *[_type == "page" && defined(slug.current)]{_id,"slug":slug.current,title,eyebrow,intro,"sections":coalesce(sections[]{...,image{...,asset->{_id,url,metadata{dimensions,lqip}}}},[]),cta,format,offerExcerpt,editorial,journal,contact,seo,image{...,asset->{_id,url,metadata{dimensions,lqip}}}},
  "people": *[_type == "person"] | order(order asc){_id,name,role,bio,portrait{...,asset->{_id,url,metadata{dimensions,lqip}}}},
  "articles": *[_type == "article" && defined(slug.current) && defined(date) && ($includeFuture || dateTime(date) <= dateTime(now())) && defined(author->name)] | order(date desc){
    _id,"slug":slug.current,title,date,excerpt,body,seo,
    "author":author->{_id,name,role,bio},"category":category->{title,"slug":slug.current},
    image{...,asset->{_id,url,metadata{dimensions,lqip}}},
    sourcePdf{asset->{_id,url,originalFilename,size,mimeType}}
  }
}`);

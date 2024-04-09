/**
 * @type {import('node-fetch').default}
 */
let fetch

try {
  fetch = require('node-fetch')
} catch (err) {
  // If require fails, use dynamic import for ESM compatibility
  let resolvedImport = null
  fetch = async (...args) => {
    if (resolvedImport != null) return resolvedImport(...args)
    resolvedImport = (await import('node-fetch')).default
    return resolvedImport(...args)
  }
}

const { CookieJar } = require('tough-cookie')

/**
 * Create a new CookieJar instance to store cookies
 * @type {import('tough-cookie').CookieJar}
 */
const cookieJar = new CookieJar()

// Function to make HTTP requests with fetch

/**
 *
 * @param {string} url
 * @param {import('node-fetch').RequestInit | undefined} options
 * @returns
 */
async function makeRequest (url, options = {}) {
  try {
    // Apply the cookie jar to the fetch options

    options.headers = Object.assign(options.headers || {}, { cookie: await cookieJar.getCookieString(url) })

    // Make the HTTP request

    const response = await fetch(url, options)
    const cookieStr = response.headers.get('set-cookie')

    if (cookieStr != null) {
      // Update the cookie jar with cookies from the response
      await cookieJar.setCookie(cookieStr, response.url)
    }

    // Return the response object
    return response
  } catch (error) {
    // Handle errors
    console.error('Error making request:', error.message)
    throw error
  }
}

// Example usage:
async function main () {
  try {
    // Make a GET request
    const responseData = await makeRequest('http://localhost:3000/api/v1/login', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'roccoahching@gmail.com',
        // username: "123",
        password: '123'
      })
    })
    console.log('Response Data:', await responseData.json())

    const response = await makeRequest('http://localhost:3000/api/v1/@me')
    console.log('Response Data:', await response.json())

    const listingsResp = await makeRequest('http://localhost:3000/api/v1/@me/listings')
    const listings = await listingsResp.json()
    console.log('Listings', listings)

    const newListingResp = await makeRequest('http://localhost:3000/api/v1/listing', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Listing',
        description: 'This is a test listing',
        price: 100
      })
    })
    const newListing = await newListingResp.json()
    console.log('New Listing', newListing)

    const listings1Resp = await makeRequest('http://localhost:3000/api/v1/@me/listings')
    const listings1 = await listings1Resp.json()
    console.log('Listings', listings1)

    const getNewestListingResp = await makeRequest(`http://localhost:3000/api/v1/listing/${newListing.id}`)
    const getNewestListing = await getNewestListingResp.json()
    console.log('Newest Listing', getNewestListing)

    console.log(listings.length, listings1.length)

    const otherUserResp = await makeRequest('http://localhost:3000/api/v1/user/1234')
    const otherUser = await otherUserResp.json()
    console.log('Other User', otherUser)

    const otherListingsResp = await makeRequest(`http://localhost:3000/api/v1/user/${otherUser.id}/listings`)
    const otherListings = await otherListingsResp.json()
    console.log('Other Listings', otherListings)

    const initChannelResp = await makeRequest('http://localhost:3000/api/v1/initChannel', {
      method: 'post',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetids: [otherUser.id],
        message: {
          content: 'Hello, how are you?'
        }
      })
    })
    const initChannel = await initChannelResp.json()
    console.log('channel', initChannel)

    const channelInfoResp = await makeRequest(`http://localhost:3000/api/v1/channel/${initChannel.id}`)
    const channelInfo = await channelInfoResp.json()
    console.log('channel info', channelInfo)

    const channelMsgsResp = await makeRequest(`http://localhost:3000/api/v1/channel/${initChannel.id}/messages`)
    const channelMsgs = await channelMsgsResp.json()
    console.log('channel msgs', channelMsgs.length)

    for (let i = 0; i < 10; i++) {
      const messageResp = await makeRequest(`http://localhost:3000/api/v1/channel/${initChannel.id}/message`, {
        method: 'post',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          content: `Hello, how are you? x${i + 1}\nI'd like to talk to you about your listing ${
            otherListings[i % otherListings.length].title
          }!`
        })
      })
      console.log('message', await messageResp.json())
    }

    const channelMsgs1Resp = await makeRequest(`http://localhost:3000/api/v1/channel/${initChannel.id}/messages`)
    const channelMsgs1 = await channelMsgs1Resp.json()
    console.log('channel msgs', channelMsgs1.length)
  } catch (error) {
    console.error('An error occurred:', error)
  }
}

// Call the main function
main()

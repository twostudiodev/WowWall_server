exports.getToken = (user) => {
    const options = {
        expires: new Date(
            Date.now() + process.env.COOKIE_EXPIRE * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        sameSite: "None",
        secure: true,
        domain: 'wowwall.in',
        path: '/'
    };

    token = user.getJWTToken();

    return { token, options }

}
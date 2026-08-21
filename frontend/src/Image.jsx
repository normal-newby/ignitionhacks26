function Image({src, className, width, height}){
    return (
        <>
            <img src={src} className={className} width={width} height={height} ></img>
        </>
    )
}

export default Image

/*

fetch(http://locahost:8080/api/customer/{name},
{method: "GET"}
).then(res => res.json())
.then(customer => console.log(res))

*/